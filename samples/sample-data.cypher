CREATE (gateway1:Gateway {type:"gateway", name:"gateway1"});
CREATE (gateway2:Gateway {type:"gateway", name:"gateway2"});
CREATE (device1:Device {type:"device", name:"device1"});
CREATE (device2:Device {type:"device", name:"device2"});
CREATE (device3:Device {type:"device", name:"device3"});
MATCH (d: Device), (g: Gateway) WHERE d.name = "device1" AND g.name = "gateway1"
CREATE (d)-[c:CONNECT]->(g);
MATCH (d: Device), (g: Gateway) WHERE d.name = "device2" AND g.name = "gateway1"
CREATE (d)-[c:CONNECT]->(g);
MATCH (d: Device), (g: Gateway) WHERE d.name = "device3" AND g.name = "gateway2"
CREATE (d)-[c:CONNECT]->(g);
MATCH (g:Gateway) SET g.uid = apoc.create.uuid();
MATCH (d:Device) SET d.uid = apoc.create.uuid();
MATCH (g:Gateway)
CREATE (t:TelegrafDS {type:"telegraf", name: g.name + "_telegraf", uid: g.uid})
MERGE (t)-[:MONITOR]->(g);
MATCH (d:Device)
CREATE (t:TelegrafDS {type:"telegraf", name: d.name + "_telegraf", uid: d.uid})
MERGE (t)-[:MONITOR]->(d);