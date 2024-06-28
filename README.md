# ENTRUST-DT: Digital Twin Prototype for Misbehaviour Detection & Attack Validation

## Installation

This software requires the following versions of node and yarn:

```
node version v20.2.0
yarn version 1.22.19
```

Install dependencies:

```
yarn install
npm install axios
```

Build local Docker image (the rest of the Docker images are pulled from web):

```
docker build -t entrust-dt -f docker/Dockerfile .
```

Create and activate environment containing following packages (e.g. in Anaconda, venv):
```
python (v3.10)
flask (v3.0.0 or higher)
neo4j (v5.19.0)
influxdb-client (latest)
```

## Setup

(cmd) Launch databases in docker:

```
docker compose up
```

(cmd) Run in another terminal:

```
yarn run dev
```

(venv, Anaconda) Run in environment:

```
python connection/neo4j_api.py
python connection/influxdb_api.py
```

Open the dashboard in browser: http://localhost:3000, choose "New Dashboard". 
Log in with user name: neo4j, password: entrust-neo4j.

If the database is empty, load a dashboard by pressing load dashboard button in left side panel. Choose "Select from file", and choose the most recent dashboard from the "samples" folder. To get the actual data, Open Neo4j Browser at http://localhost:7474. Copy the content in sample-data.cypher (not the lines under comments) and paste it into the query box of the Neo4j browser and run it.

## User Guide for NeoDash

NeoDash comes with built-in examples of dashboards and reports. For more details on the types of reports and how to customize them, see the [User Guide](
https://neo4j.com/labs/neodash/2.2/user-guide/).

