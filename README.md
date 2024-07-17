# ENTRUST-DT: Digital Twin Prototype for Misbehaviour Detection & Attack Validation

## Installation

This software requires the following versions of node, yarn and npm:

```
node version 20.2.0
yarn version 1.22.19
npm version 9.6.6
```

Create environment containing following packages (e.g. via Anaconda, venv):
```
python (v3.10)
flask (v3.0.0 or higher)
neo4j (v5.19.0)
influxdb-client (latest)
```

(cmd) While located in entrust-dt, install dependencies:
```
yarn install
npm install axios
```

## Setup

(cmd) While located in entrust-dt, launch services and databases:

```
docker compose up
```

(cmd) While located in entrust-dt, in another terminal, run:

```
yarn run dev
```

(venv, Anaconda) While located in entrust-dt/connection, run in the activate environment:

```
python neo4j_api.py
python influxdb_api.py
```

Open the dashboard in browser: http://localhost:3000, choose "New Dashboard". 
Log in with user name: neo4j, password: entrust-neo4j.

If the database is empty, load a dashboard by pressing load dashboard button in left side panel. Choose "Select from file", and choose the most recent dashboard from the "samples" folder.
To populate the knowledge graph, open Neo4j Browser at http://localhost:7474. Copy the content in sample-data.cypher (everything before the first comment) and paste it into the query box of the Neo4j browser and run it. 

## User Guide for NeoDash

NeoDash comes with built-in examples of dashboards and reports. For more details on the types of reports and how to customize them, see the [User Guide](
https://neo4j.com/labs/neodash/2.2/user-guide/).

