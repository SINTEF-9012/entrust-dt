CREATE (gateway1:Gateway {
    name : "no.sintef.sct.giot:rpi-era-1"
})
CREATE (telegraf1:TelegrafDS {
})
CREATE (gateway2:Gateway {
    name: "no.sintef.sct.giot:tellu-rpm-gateway-001"
})
CREATE (telegraf2:TelegrafDS {
})
CREATE (gateway3:Gateway {
    name: "no.sintef.sct.giot:tellu-rpm-gateway-002"
})
CREATE (telegraf3:TelegrafDS {
})
CREATE (platform:Platform {name: "TelluCare eHealth"})
CREATE (gateway1)-[:CONNECTED_TO]->(platform)
CREATE (gateway2)-[:CONNECTED_TO]->(platform)
CREATE (gateway3)-[:CONNECTED_TO]->(platform)
CREATE (telegraf1)-[:DATA_OF]->(gateway1)
CREATE (telegraf2)-[:DATA_OF]->(gateway2)
CREATE (telegraf3)-[:DATA_OF]->(gateway3)

# Delete everything:
MATCH (n) DETACH DELETE n