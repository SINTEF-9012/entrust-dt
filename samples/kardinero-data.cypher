"BEGIN
CREATE CONSTRAINT ON (node:`UNIQUE IMPORT LABEL`) ASSERT (node.`UNIQUE IMPORT ID`) IS UNIQUE;
COMMIT
SCHEMA AWAIT
BEGIN
UNWIND [{_id:8, properties:{uid:"214a51f0-3af4-4c35-a1bc-d8dc74dad81f", name:"logging_misbehaviour", type:"misbehaviour"}}, {_id:9, properties:{uid:"43717a75-33d9-4399-8c4e-421bb69149b5", name:"idle_misbehaviour", type:"misbehaviour"}}, {_id:10, properties:{uid:"c91c8c39-6b55-4dbc-a054-5f39dcfbcfc8", name:"Tracer_misbehaviour", type:"misbehaviour"}}, {_id:11, properties:{uid:"e78967c7-0e0b-4b07-8738-dada8698bc38", name:"main_misbehaviour", type:"misbehaviour"}}, {_id:12, properties:{uid:"f414d24c-a3b8-459a-b837-2b71719f4f44", name:"sysworkq_misbehaviour", type:"misbehaviour"}}] AS row
CREATE (n:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row._id}) SET n += row.properties SET n:Misbehaviour;
UNWIND [{_id:5, properties:{name:"mock_gateway", type:"gateway"}}] AS row
CREATE (n:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row._id}) SET n += row.properties SET n:Gateway;
UNWIND [{_id:6, properties:{name:"mock_device", type:"device"}}, {_id:15, properties:{uid:"cde4ddb3-b05a-46f9-bcf0-7eec0eb38263", name:"KardinBLU", type:"device"}}] AS row
CREATE (n:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row._id}) SET n += row.properties SET n:Device;
UNWIND [{_id:0, properties:{uid:"214a51f0-3af4-4c35-a1bc-d8dc74dad81f", name:"logging", type:"thread"}}, {_id:1, properties:{uid:"43717a75-33d9-4399-8c4e-421bb69149b5", name:"idle", type:"thread"}}, {_id:2, properties:{uid:"c91c8c39-6b55-4dbc-a054-5f39dcfbcfc8", name:"Tracer", type:"thread"}}, {_id:3, properties:{uid:"e78967c7-0e0b-4b07-8738-dada8698bc38", name:"main", type:"thread"}}, {_id:13, properties:{uid:"f414d24c-a3b8-459a-b837-2b71719f4f44", name:"sysworkq", type:"thread"}}] AS row
CREATE (n:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row._id}) SET n += row.properties SET n:Thread;
UNWIND [{_id:4, properties:{uid:"cde4ddb3-b05a-46f9-bcf0-7eec0eb38263", name:"KardinBLU_telegraf", type:"telegraf"}}] AS row
CREATE (n:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row._id}) SET n += row.properties SET n:TelegrafDS;
COMMIT
BEGIN
UNWIND [{start: {_id:0}, end: {_id:15}, properties:{}}, {start: {_id:1}, end: {_id:15}, properties:{}}, {start: {_id:2}, end: {_id:15}, properties:{}}, {start: {_id:3}, end: {_id:15}, properties:{}}, {start: {_id:13}, end: {_id:15}, properties:{}}] AS row
MATCH (start:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row.start._id})
MATCH (end:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row.end._id})
CREATE (start)-[r:THREAD_OF]->(end) SET r += row.properties;
UNWIND [{start: {_id:15}, end: {_id:5}, properties:{}}, {start: {_id:6}, end: {_id:5}, properties:{}}] AS row
MATCH (start:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row.start._id})
MATCH (end:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row.end._id})
CREATE (start)-[r:CONNECT]->(end) SET r += row.properties;
UNWIND [{start: {_id:4}, end: {_id:15}, properties:{}}] AS row
MATCH (start:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row.start._id})
MATCH (end:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row.end._id})
CREATE (start)-[r:MONITOR]->(end) SET r += row.properties;
UNWIND [{start: {_id:10}, end: {_id:2}, properties:{}}, {start: {_id:11}, end: {_id:3}, properties:{}}, {start: {_id:12}, end: {_id:13}, properties:{}}, {start: {_id:8}, end: {_id:0}, properties:{}}, {start: {_id:9}, end: {_id:1}, properties:{}}] AS row
MATCH (start:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row.start._id})
MATCH (end:`UNIQUE IMPORT LABEL`{`UNIQUE IMPORT ID`: row.end._id})
CREATE (start)-[r:ANALYZE]->(end) SET r += row.properties;
COMMIT
BEGIN
MATCH (n:`UNIQUE IMPORT LABEL`)  WITH n LIMIT 20000 REMOVE n:`UNIQUE IMPORT LABEL` REMOVE n.`UNIQUE IMPORT ID`;
COMMIT
BEGIN
DROP CONSTRAINT ON (node:`UNIQUE IMPORT LABEL`) ASSERT (node.`UNIQUE IMPORT ID`) IS UNIQUE;
COMMIT
"