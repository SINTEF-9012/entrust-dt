from flask import Flask, request, jsonify
from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timezone
import requests
import csv
import pandas as pd
import os

app = Flask(__name__)

INFLUXDB_URL = 'http://localhost:8086'
INFLUXDB_TOKEN = 'entrust_influxdb_admin_token'
INFLUXDB_ORG = 'entrust'
GRAFANA_URL = 'http://localhost:3100'  # Your Grafana instance URL
GRAFANA_SERVICE_ACCOUNT_TOKEN = ""  # OBS! Replace with Grafana generated token in Service Accounts

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
    response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.after_request
def apply_cors(response):
    return add_cors_headers(response)

@app.route('/influxdb_query_visualization', methods=['GET'])
def influxdb_query_visualization():
    bucket_id = request.args.get('agent_id')
    metrics = request.args.get('metrics')
    fields = request.args.get('fields')
    start_time = request.args.get('start')
    end_time = request.args.get('end')
    print("[influxdb_api.py] InfluxDB query requests "+ str(metrics) + " from agent with id " + bucket_id)

    client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
    query_api = client.query_api()

    metrics_list = metrics.split(',') if metrics else []
    fields_list = fields.split(',') if fields else []

    filters = " or ".join([f'r._measurement == "{metric.strip()}"' for metric in metrics_list])
    filter_query = f"|> filter(fn: (r) => {filters})"

    field_filters = " or ".join([f'r._field == "{field.split(".")[1]}"' for field in fields_list])
    field_filter_query = f"|> filter(fn: (r) => {field_filters})" if field_filters else ""

    converted_start_time = start_time + ":00Z"
    converted_end_time = end_time + ":00Z"

    query = f"""
    from(bucket: "{bucket_id}")
    |> range(start: {converted_start_time}, stop: {converted_end_time})
    {filter_query}
    {field_filter_query}
    """

    print("Query:")
    print(query)

    result = query_api.query(org=INFLUXDB_ORG, query=query)
    print(result)

    output = []
    for table in result:
        for record in table.records:
            output.append({
                "time": record.get_time(),
                "measurement": record.get_measurement(),
                "field": record.get_field(),
                "value": record.get_value(),
            })

    client.close()

    # Create Grafana dashboard
    # dashboard = {"url": "NONE"}
    dashboard = create_grafana_dashboard(bucket_id, metrics_list, fields_list, converted_start_time, converted_end_time)

    print("[influxdb_api.py] InfluxDB query request processed for agent with ID " + bucket_id)

    return jsonify({
        "data": output,
        "grafanaUrl": dashboard['url']
    })

def create_grafana_dashboard(agent_id, metrics, fields, start_time, end_time):
    headers = {
        'Authorization': f'Bearer {GRAFANA_SERVICE_ACCOUNT_TOKEN}',
        'Content-Type': 'application/json'
    }

    panels = []
    panel_id = 1

    for metric in metrics:
        for field in fields:
            if field.startswith(metric + '.'):
                field_name = field.split('.')[1]
                
                panel = {
                    "id": panel_id,
                    "title": f"{field}",
                    "type": "timeseries",
                    "datasource": {
                        "uid": agent_id,
                        "type": "influxdb"
                    },
                    "targets": [
                        {
                            "query": f'from(bucket:"{agent_id}") |> range(start: {start_time}, stop: {end_time}) |> filter(fn: (r) => r._measurement == "{metric}" and r._field == "{field_name}")'
                        }
                    ],
                    "gridPos": {
                        "h": 8,
                        "w": 10,
                        "x": (panel_id % 2) * 12,
                        "y": (panel_id // 2) * 9
                    }
                }
                
                panels.append(panel)
                panel_id += 1

    dashboard = {
        "dashboard": {
            "title": f"Dashboard for {agent_id}",
            "tags": ["dynamic"],
            "timezone": "browser",
            "panels": panels,
            "schemaVersion": 16,
            "version": 0,
            "refresh": "5s"
        },
        "overwrite": True
    }

    try:
        print("[influxdb_api.py] Sending request to Grafana with the following payload:")
        print(f"[influxdb_api.py] URL: {GRAFANA_URL}/api/dashboards/db")
        print("[influxdb_api.py] Headers:", headers)
        print("[influxdb_api.py] Payload:", dashboard)

        response = requests.post(f'{GRAFANA_URL}/api/dashboards/db', headers=headers, json=dashboard)
        response.raise_for_status()

        dashboard_data = response.json()
        print("[influxdb_api.py] Response from Grafana:", dashboard_data)

        dashboard_url = f"{GRAFANA_URL}/d/{dashboard_data['uid']}/{dashboard_data['slug']}"
        return {"url": dashboard_url}

    except requests.exceptions.HTTPError as http_err:
        print(f'[influxdb_api.py] HTTP error occurred: {http_err}')
        print(f'[influxdb_api.py] Response Content: {response.content}')
        if response.status_code == 412:
            print("[influxdb_api.py] Precondition Failed. Check if the payload is correct and the token has necessary permissions.")
    except Exception as err:
        print(f'[influxdb_api.py] Other error occurred: {err}')

    return {"url": None}

@app.route('/influxdb_query_by_points', methods=['GET'])
def influxdb_query_by_points():
    try:
        bucket_id = request.args.get('bucket_id')
        number_points = request.args.get('number_points')
        asset_name = request.args.get('asset_name')
        print("[influxdb_api.py] InfluxDB query requests last "+ str(number_points) + " points from traced asset in bucket tracer_" + bucket_id)

        client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        query_api = client.query_api()

        # Query the last numPoints points from the specified bucket:
        query = f'''
        from(bucket: "tracer_{bucket_id}")
            |> range(start: -{number_points})
            |> sort(columns: ["timestamp"], desc: true) 
            |> limit(n: {number_points})
        '''
        result = query_api.query(org=INFLUXDB_ORG, query=query)

        # Process the result
        response_data = []
        for table in result:
            for record in table.records:
                response_data.append({
                    "time": record.get_time(),
                    "field": record.get_field(),
                    "value": record.get_value(),
                    "measurement": record.get_measurement()
                })

        # Convert the data to a DataFrame
        df = pd.DataFrame(response_data)

         # Sort the DataFrame by time in ascending order
        df = df.sort_values(by="time", ascending=True)

        # Pivot the data to have measurements as columns
        df_pivot = df.pivot_table(index='time', columns='measurement', values='value')

        # Reset the index to bring the time (now timestamp) back as a column
        df_pivot = df_pivot.reset_index()

        # Replace the 'time' column with a sequential index
        df_pivot = df_pivot.rename(columns={'time': 'timestamp'})
        df_pivot['timestamp'] = range(1, len(df_pivot) + 1)  # Replace timestamp with a simple index

         # Prefix asset name to each measurement column
        df_pivot = df_pivot.rename(columns=lambda x: f"{asset_name}_{x}" if x != 'timestamp' else x)

        # Ensure the directory exists
        os.makedirs('Inference', exist_ok=True)

        # Save the pivoted DataFrame to CSV
        csv_file = f"Inference/inference_data_{bucket_id}.csv"
        df_pivot.to_csv(csv_file, index=False)

        print(f"[influxdb_api.py] Data saved to {csv_file}")

        print("[influxdb_api.py] InfluxDB query request processed for traced asset in bucket " + bucket_id)
        # Return the result as a JSON response
        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"[influxdb_api.py] Error in querying by points": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=False, port=5005)

