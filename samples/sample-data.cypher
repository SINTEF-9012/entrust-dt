CREATE (gateway1:Gateway {type:"gateway", name:"logging"});
CREATE (gateway2:Gateway {type:"gateway", name:"idle"});
CREATE (device1:Device {type:"device", name:"Tracer"});
CREATE (device2:Device {type:"device", name:"main"});
CREATE (device3:Device {type:"device", name:"sysworkq"});
MATCH (d: Device), (g: Gateway) WHERE d.name = "Tracer" AND g.name = "logging"
CREATE (d)-[c:CONNECT]->(g);
MATCH (d: Device), (g: Gateway) WHERE d.name = "main" AND g.name = "logging"
CREATE (d)-[c:CONNECT]->(g);
MATCH (d: Device), (g: Gateway) WHERE d.name = "sysworkq" AND g.name = "idle"
CREATE (d)-[c:CONNECT]->(g);
MATCH (g:Gateway) SET g.uid = apoc.create.uuid();
MATCH (d:Device) SET d.uid = apoc.create.uuid();
MATCH (g:Gateway)
CREATE (t:TelegrafDS {type:"telegraf", name: g.name + "_telegraf", uid: g.uid})
MERGE (t)-[:MONITOR]->(g);
MATCH (d:Device)
CREATE (t:TelegrafDS {type:"telegraf", name: d.name + "_telegraf", uid: d.uid})
MERGE (t)-[:MONITOR]->(d);
MATCH (g:Gateway)
CREATE (m:Misbehaviour {type:"misbehaviour", name: g.name + "_misbehaviour", uid: g.uid})
MERGE (m)-[:ANALYZE]->(g);
MATCH (d:Device)
CREATE (m:Misbehaviour {type:"misbehaviour", name: d.name + "_misbehaviour", uid: d.uid})
MERGE (m)-[:MONITOR]->(d);