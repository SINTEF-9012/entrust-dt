from flask import Flask, request, jsonify
from neo4j import GraphDatabase
import configparser
import json
import os
import yaml


config_neo4j = configparser.ConfigParser()
config_neo4j.read('neo4j_config.ini')

app = Flask(__name__)

driver = GraphDatabase.driver(config_neo4j.get('neo4j','NEO4J_URI'), auth=(config_neo4j.get('neo4j','NEO4J_USERNAME'), config_neo4j.get('neo4j','NEO4J_PASSWORD')))

# Define a function to set the CORS headers
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'  # allowed origin
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST, DELETE'  # Adjust as needed
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

# Apply the CORS function to all routes using the after_request decorator
@app.after_request
def apply_cors(response):
    return add_cors_headers(response)

#______________________________________________API___________________________________________________
@app.route('/neo4j_run_query', methods=['POST'])
def neo4j_run_query():
    data = request.json
    query = data['query']
    print("[neo4j_api.py] Received query to execute in Neo4J:", query)
    with driver.session() as session:
        session_result = session.run(query)
        # We are assuming that the query returns something to jsonify
        results = [record.data() for record in session_result]
        return jsonify(results)
    
@app.route('/neo4j_add_relation', methods=['POST'])
def neo4j_add_relation():
    data = request.json
    # Extracting fields from the request
    deviceSourceUid = data.get("sourceUid", "")
    deviceTargetUid = data.get("targetUid", "")
    deviceSourcePhase = data.get("sourcePhase", "")
    deviceTargetPhase = data.get("targetPhase", "")
    # Construct the Cypher query
    if deviceTargetPhase == deviceSourcePhase:
        # Same phase
        if deviceTargetPhase == "design":
            # Both in design phase
            query = f"""
            MATCH (source:Device {{uid: '{deviceSourceUid}'}})
            MATCH (target:Device {{uid: '{deviceTargetUid}'}})
            WITH source, target
            CALL {{
                WITH source
                CREATE (s:Device)
                SET s = source
                SET s.uid = apoc.create.uuid(),
                    s.phase = 'predeployment'
                RETURN s
            }}
            CALL {{
                WITH target
                CREATE (t:Device)
                SET t = target
                SET t.uid = apoc.create.uuid(),
                    t.phase = 'predeployment'
                RETURN t
            }}
            WITH s, t
            CALL {{
                WITH s
                CREATE (srcTracer:Tracer {{
                    type: "functional",
                    name: s.name + "_tracer",
                    phase: s.phase,
                    uid: s.uid,
                    bucket: s.phase + "-" + s.uid
                }})
                MERGE (srcTracer)-[:MONITORS]->(s)
                CREATE (srcMis:Misbehaviour {{
                    type: "functional",
                    name: srcTracer.name + "_misbehaviour",
                    phase: srcTracer.phase,
                    uid: srcTracer.uid
                }})
                MERGE (srcMis)-[:ANALYZES]->(srcTracer)
                RETURN srcTracer, srcMis
            }}
            CALL {{
                WITH t
                CREATE (tgtTracer:Tracer {{
                    type: "functional",
                    name: t.name + "_tracer",
                    phase: t.phase,
                    uid: t.uid,
                    bucket: t.phase + "-" + t.uid
                }})
                MERGE (tgtTracer)-[:MONITORS]->(t)
                CREATE (tgtMis:Misbehaviour {{
                    type: "functional",
                    name: tgtTracer.name + "_misbehaviour",
                    phase: tgtTracer.phase,
                    uid: tgtTracer.uid
                }})
                MERGE (tgtMis)-[:ANALYZES]->(tgtTracer)
                RETURN tgtTracer, tgtMis
            }}
            MERGE (s)-[:CONNECTS_TO]->(t)
            RETURN s, t
            """
        else:
            # Both in predeployment phase
            query = f"""
            MATCH (s:Device {{uid: '{deviceSourceUid}', phase: 'predeployment'}})
            MATCH (t:Device {{uid: '{deviceTargetUid}', phase: 'predeployment'}})
            MERGE (s)-[:CONNECTS_TO]->(t)
            RETURN s, t
            """
    else:
        # Different phases for both devices:
        if deviceTargetPhase == "design" and deviceSourcePhase == "predeployment":
            # Target in design phase and source in predeployment
            query = f"""
                MATCH (s:Device {{uid: '{deviceSourceUid}', phase: 'predeployment'}})
                MATCH (target:Device {{uid: '{deviceTargetUid}', phase: 'design'}})
                CALL {{
                    WITH target
                    CREATE (t:Device)
                    SET t = target
                    SET t.uid = apoc.create.uuid(),
                        t.phase = 'predeployment'
                    RETURN t
                }}
                CALL {{
                    WITH t
                    CREATE (tracer:Tracer {{
                        type: "functional",
                        name: t.name + "_tracer",
                        phase: t.phase,
                        uid: t.uid,
                        bucket: t.phase + "-" + t.uid
                    }})
                    MERGE (tracer)-[:MONITORS]->(t)
                    CREATE (mis:Misbehaviour {{
                        type: "functional",
                        name: tracer.name + "_misbehaviour",
                        phase: tracer.phase,
                        uid: tracer.uid
                    }})
                    MERGE (mis)-[:ANALYZES]->(tracer)
                    RETURN tracer, mis
                }}
                MERGE (s)-[:CONNECTS_TO]->(t)
                RETURN s, t
            """
        else:
            # Source in design phase and target in predeployment
            query = f"""
            MATCH (source:Device {{uid: '{deviceSourceUid}', phase: 'design'}})
            MATCH (t:Device {{uid: '{deviceTargetUid}', phase: 'predeployment'}})
            CALL {{
                WITH source
                CREATE (s:Device)
                SET s = source
                SET s.uid = apoc.create.uuid(),
                    s.phase = 'predeployment'
                RETURN s
            }}
            CALL {{
                WITH s
                CREATE (tracer:Tracer {{
                    type: "functional",
                    name: s.name + "_tracer",
                    phase: s.phase,
                    uid: s.uid,
                    bucket: s.phase + "-" + s.uid
                }})
                MERGE (tracer)-[:MONITORS]->(s)
                CREATE (mis:Misbehaviour {{
                    type: "functional",
                    name: tracer.name + "_misbehaviour",
                    phase: tracer.phase,
                    uid: tracer.uid
                }})
                MERGE (mis)-[:ANALYZES]->(tracer)
                RETURN tracer, mis
            }}
            MERGE (s)-[:CONNECTS_TO]->(t)
            RETURN s, t
            """
    print("[neo4j_api.py] Received query to execute in Neo4j:\n", query)
    try:
        with driver.session() as session:
            session_result = session.run(query)
            # Ensure DomainTracer exists and connects to all predeployment tracers
            domain_tracer_query = """
                MERGE (domain:DomainTracer {phase: 'predeployment'})
                ON CREATE SET domain.uid = apoc.create.uuid(),
                            domain.type = 'functional',
                            domain.name = 'domain_tracer'
                WITH domain
                MERGE (domainMis:Misbehaviour {uid: domain.uid, phase: domain.phase})
                ON CREATE SET domainMis.type = 'functional',
                            domainMis.name = domain.name + "_misbehaviour"
                MERGE (domainMis)-[:ANALYZES]->(domain)
            """
            session.run(domain_tracer_query)
            add_bucket_query = """
            MATCH (domain:DomainTracer)
            SET domain.bucket = 'predeployment-' + domain.uid
            RETURN domain
            """
            domain_result = session.run(add_bucket_query)
            # If DomainTracer was created, add it to the results
            results = [
                {
                    "s": record["s"]._properties,
                    "t": record["t"]._properties,
                }
                for record in session_result
            ]
            results_domain = [
                {
                    "dt": record["domain"]._properties
                }
                for record in domain_result
            ]
            if results_domain:
                dt_props = results_domain[0]["dt"]  # there’s only one DomainTracer
                for res in results:
                    res["dt"] = dt_props
            connect_tracer_query = """
                MATCH (domain:DomainTracer {phase: 'predeployment'})
                MATCH (t:Tracer {phase: 'predeployment'})
                MERGE (domain)-[:AGGREGATES]->(t)
            """
            session.run(connect_tracer_query)
        print("HERE")
        print(results)
        return jsonify(results), 200
    except Exception as e:
        print("[neo4j_api.py] Error executing Neo4j query:", e)
        return jsonify({"error": str(e)}), 500
    
@app.route('/neo4j_add_node', methods=['POST'])
def neo4j_add_node():
    data = request.json
    # Extracting fields from the request
    deviceName = data.get("name", "")
    deviceCpuRequest = data.get("cpuRequest", "")
    deviceMemRequest = data.get("memRequest", "")
    deviceCpuLimit = data.get("cpuLimit", "")
    deviceMemLimit = data.get("memLimit", "")
    dockerImage = data.get("dockerImage", "")
    # Selected tier :
    deviceTier = "low" if bool(data.get("tierLow", "")) else "high"

    # Construct the Cypher query with safe string formatting
    query = f"""
        CREATE (d:Device {{
            name: "{deviceName}",
            tier: "{deviceTier}",
            cpuRequest: "{deviceCpuRequest}",
            memoryRequest: "{deviceMemRequest}",
            cpuLimit: "{deviceCpuLimit}",
            memoryLimit: "{deviceMemLimit}",
            dockerImage: "{dockerImage}",
            type: "system",
            phase: "design"
        }})
        SET d.uid = apoc.create.uuid()

        WITH d
        CREATE (t:Tracer {{
            type: "functional",
            name: d.name + "_tracer",
            phase: d.phase,
            uid: d.uid,
            bucket: d.phase + "-" + d.uid
        }})
        MERGE (t)-[:MONITORS]->(d)

        WITH d, t
        CREATE (mis:Misbehaviour {{
            type: "functional",
            name: t.name + "_misbehaviour",
            phase: t.phase,
            uid: t.uid
        }})
        MERGE (mis)-[:ANALYZES]->(t)

        RETURN d, t, mis
    """
    print("[neo4j_api.py] Received query to execute in Neo4j:\n", query)
    try:
        with driver.session() as session:
            session_result = session.run(query)
            results = [record["d"] for record in session_result]  # Return the created node
            return jsonify([dict(r) for r in results]), 200
    except Exception as e:
        print("[neo4j_api.py] Error executing Neo4j query:", e)
        return jsonify({"error": str(e)}), 500
    
@app.route('/neo4j_clear_all', methods=['DELETE'])
def neo4j_clear_all():
    # Construct the Cypher query with safe string formatting
    query = f"""
        MATCH (n) WHERE n.phase = "predeployment" DETACH DELETE n
    """
    print("[neo4j_api.py] Received query to execute in Neo4j:\n", query)
    try:
        with driver.session() as session:
            session.run(query)
        return jsonify({"status": "Predeployment graph cleared."}), 200
    except Exception as e:
        print("[neo4j_api.py] Error executing Neo4j query:", e)
        return jsonify({"error": str(e)}), 500
    
@app.route('/neo4j_delete_device', methods=['POST'])
def neo4j_delete_device():
    data = request.json
    uid = data.get("uid", "")
    query = """
        MATCH (n)
        WHERE n.uid = $uid
        DETACH DELETE n
    """
    print("[neo4j_api.py] Received query to execute in Neo4j:\n", query)
    try:
        with driver.session() as session:
            session.run(query, {"uid": uid})
        return jsonify({"status": f"Device {uid} deleted successfully."}), 200
    except Exception as e:
        print("[neo4j_api.py] Error executing Neo4j query:", e)
        return jsonify({"error": str(e)}), 500
    
@app.route('/neo4j_download_topology', methods=['GET'])
def neo4j_download_topology():
    query = """
    MATCH (n:Device)-[r]->(m:Device)
    WHERE n.phase = 'predeployment' AND m.phase = 'predeployment'
    RETURN n, r, m
    UNION
    MATCH (n:Device)
    WHERE n.phase = 'predeployment' AND NOT (n)--()
    RETURN n, null AS r, null AS m
    """
    try:
        with driver.session() as session:
            results = session.run(query)

            nodes = {}
            relationships = []

            for record in results:
                n = record['n']
                n_id = str(n.element_id)
                if n_id not in nodes:
                    nodes[n_id] = {
                        "id": n_id,
                        "labels": list(n.labels),
                        "properties": dict(n.items()),
                    }

                if record['m']:
                    m = record['m']
                    m_id = str(m.element_id)
                    if m_id not in nodes:
                        nodes[m_id] = {
                            "id": m_id,
                            "labels": list(m.labels),
                            "properties": dict(m.items()),
                        }

                print("RELATIONSHIP RECORD:", record['r'])
                r = record.get('r')
                if r is not None:
                    relationships.append({
                        "id": str(r.element_id),
                        "type": r.type,
                        "startNode": str(r.start_node.element_id),
                        "endNode": str(r.end_node.element_id),
                        "properties": dict(r.items()),  # or r._properties if needed
                    })

            topology = {
                "nodes": list(nodes.values()),
                "relationships": relationships,
            }

            # Ensure the downloads directory exists
            os.makedirs("downloads", exist_ok=True)

            # Write the file locally
            with open("downloads/topology.json", "w") as f:
                json.dump(topology, f, indent=2)

            print("[neo4j_api.py] Topology exported to downloads/topology.json")
            return jsonify({"status": "Topology saved."}), 200

    except Exception as e:
        print("[neo4j_api.py] Error generating topology download:", e)
        return jsonify({"error": str(e)}), 500
    
@app.route('/neo4j_load_topology', methods=['POST'])
def neo4j_load_topology():
    data = request.get_json()
    nodes = data.get("nodes", [])
    relationships = data.get("relationships", [])
    try:
        with driver.session() as session:
            # 1. Clear old predeployment data
            session.run("MATCH (n) WHERE n.phase = 'predeployment' DETACH DELETE n")
            print("[neo4j_api.py] Deleted existing predeployment graph.")
            # 2. Create nodes and build ID→UID map
            id_to_uid = {}
            for node in nodes:
                labels = ":".join(node.get("labels", [])) or "Node"
                props = node.get("properties", {})
                node_id = node.get("id")
                uid = props.get("uid")
                phase = props.get("phase")
                name = props.get("name")

                if uid and node_id:
                    id_to_uid[node_id] = uid
                # 2a. Create Device node
                query = f"CREATE (n:{labels}) SET n = $props"
                session.run(query, {"props": props})
                # 2b. Create Tracer and Misbehaviour nodes for this device
                tracer_props = {
                    "type": "functional",
                    "name": f"{name}_tracer",
                    "phase": phase,
                    "uid": uid,
                    "bucket": f"{phase}-{uid}"
                }
                mis_props = {
                    "type": "functional",
                    "name": f"{name}_tracer_misbehaviour",
                    "phase": phase,
                    "uid": uid
                }
                session.run("""
                    CALL {
                        MATCH (d:Device {uid: $uid})
                        WITH d LIMIT 1
                        CREATE (t:Tracer)
                        SET t = $tracer_props
                        CREATE (m:Misbehaviour)
                        SET m = $mis_props
                        MERGE (t)-[:MONITORS]->(d)
                        MERGE (m)-[:ANALYZES]->(t)
                    }
                """, {
                    "uid": uid,
                    "tracer_props": tracer_props,
                    "mis_props": mis_props
                })
            # 3. Create relationships using uid from mapped ids
            for rel in relationships:
                rel_type = rel.get("type", "CONNECTED_TO")
                props = rel.get("properties", {})

                start_id = rel.get("startNode")
                end_id = rel.get("endNode")
                start_uid = id_to_uid.get(str(start_id))
                end_uid = id_to_uid.get(str(end_id))

                if start_uid and end_uid:
                    query = f"""
                    MATCH (a:Device {{uid: $start_uid}})
                    MATCH (b:Device {{uid: $end_uid}})
                    CREATE (a)-[r:{rel_type}]->(b)
                    SET r = $props
                    """
                    session.run(query, {
                        "start_uid": start_uid,
                        "end_uid": end_uid,
                        "props": props
                    })
            #print(f"[neo4j_api.py] Created {len(relationships)} relationships.")
            #return jsonify({"status": "Topology loaded successfully."}), 200
            # 4. Collect all Tracer buckets
            bucket_query = """
                MATCH (t:Tracer {phase: 'predeployment'})
                RETURN t.uid AS uid, t.bucket AS bucket
            """
            result = session.run(bucket_query)
            buckets = {record["uid"]: record["bucket"] for record in result}
            print(f"[neo4j_api.py] Created {len(relationships)} relationships and collected {len(buckets)} buckets.")
            return jsonify({"buckets": buckets}), 200
    except Exception as e:
        print("[neo4j_api.py] Error loading topology:", e)
        return jsonify({"error": str(e)}), 500
    
@app.route('/neo4j_deployment', methods=['POST'])
def neo4j_deployment():
    try:
        with driver.session() as session:
            query = """
            CALL {
                MATCH (n) WHERE n.phase = "runtime"
                DETACH DELETE n
            }

            WITH 1 as dummy
            
            MATCH (d:Device {phase: 'predeployment'})
            CALL {
                WITH d
                CREATE (dClone:Device)
                SET dClone = d
                SET dClone.uid = apoc.create.uuid(),
                    dClone.phase = 'runtime'
                MERGE (dClone)-[:CLONED_FROM]->(d)
                CREATE (t:Tracer {
                    type: "functional",
                    name: dClone.name + "_tracer",
                    phase: dClone.phase,
                    uid: dClone.uid,
                    bucket: dClone.phase + "-" + dClone.uid
                })
                MERGE (t)-[:MONITORS]->(dClone)
                CREATE (m:Misbehaviour {
                    type: "functional",
                    name: t.name + "_misbehaviour",
                    phase: t.phase,
                    uid: t.uid
                })
                MERGE (m)-[:ANALYZES]->(t)
                RETURN dClone
            }

            MATCH (a:Device {phase: 'predeployment'})-[r:CONNECTS_TO]->(b:Device {phase: 'predeployment'})
            MATCH (aClone:Device)-[:CLONED_FROM]->(a)
            MATCH (bClone:Device)-[:CLONED_FROM]->(b)
            MERGE (aClone)-[rClone:CONNECTS_TO]->(bClone)
            SET rClone = r
            WITH *
            MATCH (:Device)-[r:CLONED_FROM]->(:Device)
            DELETE r
            """
            session.run(query)

            # 2. Ensure DomainTracer exists
            domain_tracer_query = """
            MERGE (domain:DomainTracer {phase: 'runtime'})
            ON CREATE SET domain.uid = randomUUID(),
                          domain.type = 'functional',
                          domain.name = 'domain_tracer'
            WITH domain
            MERGE (domainMis:Misbehaviour {uid: domain.uid, phase: domain.phase})
            ON CREATE SET domainMis.type = 'functional',
                          domainMis.name = domain.name + "_misbehaviour"
            MERGE (domainMis)-[:ANALYZES]->(domain)
            """
            session.run(domain_tracer_query)

            # 3. Set DomainTracer bucket separately and return node
            add_bucket_query = """
            MATCH (domain:DomainTracer {phase: 'runtime'})
            SET domain.bucket = 'runtime-' + domain.uid
            RETURN domain
            """
            domain_result = session.run(add_bucket_query)

            # 4. Connect DomainTracer to all runtime tracers
            connect_query = """
            MATCH (domain:DomainTracer {phase: 'runtime'})
            MATCH (t:Tracer {phase: 'runtime'})
            MERGE (domain)-[:AGGREGATES]->(t)
            """
            session.run(connect_query)

            # Collect runtime Tracer buckets (incl. DomainTracer bucket)
            #bucket_query = """
            #    MATCH (t:Tracer {phase: 'runtime'})
            #    RETURN t.bucket AS bucket
            #"""
            bucket_query = """
                MATCH (t:Tracer {phase: 'runtime'})
                RETURN t.bucket AS bucket
                UNION
                MATCH (dt:DomainTracer {phase: 'runtime'})
                RETURN dt.bucket AS bucket
            """
            result = session.run(bucket_query)
            buckets = [record["bucket"] for record in result]
            # return jsonify({"status": "Deployment complete."}), 200
            print(f"[neo4j_api.py] Deployment complete. Buckets have been created.")
            return jsonify({"buckets": buckets}), 200

    except Exception as e:
        print("[neo4j_api.py] Error during deployment:", e)
        return jsonify({"error": str(e)}), 500

    
@app.route('/neo4j_clear', methods=['DELETE'])
def neo4j_clear():
    phase = request.args.get('phase')
    try:
        with driver.session() as session:
            session.run("MATCH (n) WHERE n.phase = $phase DETACH DELETE n",  {"phase": phase})
        return jsonify({"status": "All nodes cleared!"}), 200
    except Exception as e:
        print("[neo4j_api.py] Error clearing:", e)
        return jsonify({"error": str(e)}), 500

@app.route('/neo4j_get_devices', methods=['GET'])
def neo4j_get_devices():
    query = "MATCH (device:Device) RETURN device.name AS name, device.uid AS uid"
    data_structure_storage = []
    with driver.session() as session:
        result = session.run(query)
        for record in result:
            # Append each device's data as a dictionary to the list
            data_structure_storage.append({
                "name": record["name"],
                "uid": record["uid"]
            })
    return jsonify(data_structure_storage)

@app.route('/neo4j_download_yaml', methods=['GET'])
def neo4j_download_yaml():
    print("[neo4j_api.py] Received request to download YAML.")
    phase = request.args.get('phase')
    # Query for all Device nodes in 'design' phase
    cypher = """
        MATCH (d:Device  {phase: $phase})
        RETURN d.name AS name,
        d.phase AS phase,
        d.uid AS uid,
        d.cpuRequest AS cpuRequest,
        d.cpuLimit AS cpuLimit,
        d.memoryRequest AS memoryRequest,
        d.memoryLimit AS memoryLimit,
        d.dockerImage AS dockerImage
    """
    devices = []

    with driver.session() as session:
        result = session.run(cypher, {"phase": phase})
        for record in result:
            devices.append({
                'apiVersion': 'apps/v1',
                'kind': 'Deployment',
                'metadata': {'name': f"emu-{record['phase']}-{record['uid']}"},
                'spec': {
                    'replicas': 1,
                    'selector': {'matchLabels': {'app': f"{record['phase']}-{record['uid']}"}},
                    'template': {
                        'metadata': {'labels': {'app': f"{record['phase']}-{record['uid']}"}},
                        'spec': {'containers': [{'name': f"{record['phase']}-{record['uid']}",
                                                'image': record['dockerImage'],
                                                'resources': {
                                                    'requests': {'cpu': record['cpuRequest'], 'memory': record['memoryRequest']},
                                                    'limits':   {'cpu': record['cpuLimit'],   'memory': record['memoryLimit']}
                                                }}]
                        }
                    }
                }
            })
    # Check for devices
    if not devices:
        print("[neo4j_api.py] No devices found for the given phase.")
        return jsonify({'message': f'No Device nodes found for phase: {phase}'}), 404

    yaml_docs = [yaml.dump(dev, sort_keys=False) for dev in devices]
    payload = '---\n'.join(yaml_docs)

    os.makedirs('downloads', exist_ok=True)
    
    # Determine file path with versioning if necessary
    base_name = "kub_" + phase
    ext = ".yaml"
    file_path = os.path.join('downloads', f"{base_name}{ext}")
    count = 1
    while os.path.exists(file_path):
        file_path = os.path.join('downloads', f"{base_name}_{count}{ext}")
        count += 1

    with open(file_path, 'w') as f:
        f.write(payload)

    print(f"[neo4j_api.py] YAML saved as {file_path}")
    return jsonify({'message': f'YAML saved to {file_path}'})

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5001)