#!/bin/bash

# Run each Python file in the background
python neo4j_api.py &
python influxdb_api.py &

# Wait for all background processes to finish
wait