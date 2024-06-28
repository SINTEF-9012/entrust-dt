from flask import Flask, request, jsonify
from neo4j import GraphDatabase

app = Flask(__name__)

# Configure Neo4j connection - TODO: Create .ini file for this too.
uri = "bolt://localhost:7687"  # Replace with your Neo4j instance
username = "neo4j"             # Replace with your username
password = "entrust-neo4j"        # Replace with your password
driver = GraphDatabase.driver(uri, auth=(username, password))

# Define a function to set the CORS headers
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'  # allowed origin
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST'  # Adjust as needed
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

# Apply the CORS function to all routes using the after_request decorator
@app.after_request
def apply_cors(response):
    return add_cors_headers(response)

@app.route('/neo4j_get_gateway_id', methods=['GET'])
def neo4j_get_gateway_id():
    agent_id = request.args.get('agent_id')
    print("[neo4j_api.py] Received request to fetch gateway id for agent id:", agent_id)
    with driver.session() as session:
        result = session.run("MATCH (a:TelegrafDS)-[:DATA_OF]->(g:Gateway) WHERE a.ID = $agent_id RETURN g.ID AS gateway_id", agent_id=agent_id)
        gateway_ids = [record["gateway_id"] for record in result]
    print("[neo4j_api.py] Gateway(s) id(s) fetched for agent id:", agent_id)
    print(gateway_ids)
    # Assuming each agent_id is associated with only one gateway_id. Adjust as needed.
    return jsonify(gateway_ids[0] if gateway_ids else None)

if __name__ == '__main__':
    app.run(host="localhost", port=5001)