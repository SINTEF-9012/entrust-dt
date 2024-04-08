from flask import Flask, request, jsonify
from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timezone

app = Flask(__name__)

# InfluxDB settings - replace these with your actual settings
INFLUXDB_URL = 'http://localhost:8086'
INFLUXDB_TOKEN = 'entrust_influxdb_admin_token'
INFLUXDB_ORG = 'entrust'

# Define a function to set the CORS headers
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'  # allowed origin
    response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'  # Adjust as needed
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# Apply the CORS function to all routes using the after_request decorator
@app.after_request
def apply_cors(response):
    return add_cors_headers(response)

@app.route('/query_influxdb', methods=['GET'])
def query_influxdb():
    bucket_id = request.args.get('gateway_id')
    metrics = request.args.get('metrics')
    start_time = request.args.get('start')
    end_time = request.args.get('end')
    print("[influxdb_api.py] InfluxDB query requests "+ str(metrics) + " from gateway with id " + bucket_id)

    # Initialize InfluxDB client
    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    query_api = client.query_api()

    # Assuming 'metrics' is a string with comma-separated values, split it into a list
    metrics_list = metrics.split(',')

    # Constructing the filter part of the query
    filters = " or ".join([f'r._measurement == "{metric.strip()}"' for metric in metrics_list])
    filter_query = f"|> filter(fn: (r) => {filters})"

    # Convert date format to compatible one (Obs: UTC, if not UTC -> adjust!)
    converted_start_time = start_time + ":00Z"
    converted_end_time = end_time + ":00Z"

    # Complete Flux query
    query = f"""
    from(bucket: "{bucket_id}")
    |> range(start: {converted_start_time}, stop: {converted_end_time})
    {filter_query}
    """

    print(query)

    # Execute the query
    result = query_api.query(org=INFLUXDB_ORG, query=query)


    # Process the results
    output = []
    for table in result:
        for record in table.records:
            output.append({
                "time": record.get_time(),
                "measurement": record.get_measurement(),
                "field": record.get_field(),
                "value": record.get_value(),

            })

    # Close the client
    client.close()

    print("[influxdb_api.py] InfluxDB query request processed for gateway with id " + bucket_id)

    return jsonify(output)


if __name__ == '__main__':
    app.run(debug=False, port=5000)
