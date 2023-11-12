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
```

Build local Docker image (the rest of the Docker images are pulled from web):

```
docker build -t entrust-dt -f docker/Dockerfile .
```

## Setup

Launch databases in docker:

```
docker compose up
```

Run in another terminal:

```
yarn run dev
```

Open the dashboard in browser: http://localhost:3000, choose "New Dashboard". 
Log in with user name: neo4j, password: entrust-neo4j.

If the database is empty, load a dashboard by pressing load dashboard button in left side panel. Choose "Select from file", and choose the most recent dashboard from the "samples" folder. To get the actual data, Open Neo4j Browser at http://localhost:7474. Copy the content in sample-data.cypher and past it into the query box of the Neo4j browser, then execute the query.

## User Guide for NeoDash

NeoDash comes with built-in examples of dashboards and reports. For more details on the types of reports and how to customize them, see the [User Guide](
https://neo4j.com/labs/neodash/2.2/user-guide/).

