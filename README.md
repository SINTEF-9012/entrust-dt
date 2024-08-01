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
python influxdb_api.py
```

Open the dashboard in browser: http://localhost:3000, choose "New Dashboard". 
Log in with user name: neo4j, password: entrust-neo4j.

If dashboard is empty, load a dashboard by pressing load dashboard button in left side panel. Choose "Select from file", and choose the "dashboard" file from the "samples" folder.
To populate the knowledge graph, open Neo4j Browser at http://localhost:7474. Copy the content from sample-data.cypher and paste it into the query box of the Neo4j browser and run it.

## Integration

Each element in the knowledge graph will be assigned with an unique ID (uid). This uid connects each device to its storage bucket, but also allows time-series visualization. Three steps enable this functionality:

1. Log into InfluxDB (localhost:8086) and Grafana (localhost:3100) using credentials.
2. In InfluxDB, create individual buckets for each device, named after their uid. Create individual API tokens with read/write rights for each bucket.
3. In Grafana, create a Service Account and generate a token. Update the GRAFANA_SERVICE_ACCOUNT_TOKEN variable in the influxdb_api.py file accordingly. Create individual data sources in Grafana, for each bucket in InfluxDB, configured as follows: name as uid, query language as Flux, URL as http://entrust_influx_db:8086, basic authentification by InfluxDB credentials, organization as entrust, and token as the one associated with the bucket. 

## User Guide for NeoDash

NeoDash comes with built-in examples of dashboards and reports. For more details on the types of reports and how to customize them, see the [User Guide](
https://neo4j.com/labs/neodash/2.2/user-guide/).

