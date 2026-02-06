from flask import Flask, request, jsonify
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime, timezone
import requests
import csv
import pandas as pd
import os
import configparser
import io

# Note: <>_config.ini files need to be provided in advance and added to connection/api folder
# InfluxDB
config_influxdb = configparser.ConfigParser()
config_influxdb.read('influxdb_config.ini')
# Grafana
config_grafana = configparser.ConfigParser()
config_grafana.read('grafana_config.ini')

app = Flask(__name__)

client = InfluxDBClient(url=config_influxdb.get('influxdb','INFLUXDB_URL'), token=config_influxdb.get('influxdb','INFLUXDB_TOKEN'), org=config_influxdb.get('influxdb','INFLUXDB_ORG'))

# OBS! Grafana token can be fetched from Service Accounts

def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'
    response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

@app.after_request
def apply_cors(response):
    return add_cors_headers(response)


@app.route('/influxdb_populate', methods=['POST'])
def influxdb_populate():
    if 'file' not in request.files or 'bucket' not in request.form:
        return jsonify({"error": "Missing file or bucket"}), 400

    file = request.files['file']
    bucket = request.form['bucket']

    print(f"[influxdb_api.py] InfluxDB request for populating bucket {bucket} with CSV data.")

    # --- Known metric suffixes for parsing ---
    known_metrics = [
        "CPU",
        "cycles",
        "usage",
        "unused",
        "Total_Memory",
        "Memory_Usage_Percentage"
    ]

    try:
        df = pd.read_csv(io.StringIO(file.stream.read().decode("utf-8")))
    except Exception as e:
        return jsonify({"error": f"Failed to parse CSV: {str(e)}"}), 400

    # Drop timestamp column if present
    if 'timestamp' in df.columns:
        df = df.drop(columns=['timestamp'])

    api_client = InfluxDBClient(
    url=config_influxdb.get('influxdb', 'INFLUXDB_URL'),
    token=config_influxdb.get('influxdb', 'INFLUXDB_TOKEN'),
    org=config_influxdb.get('influxdb', 'INFLUXDB_ORG')
    )

    write_api = api_client.write_api(write_options=SYNCHRONOUS)

    # Iterate through rows and write per-thread metrics
    for _, row in df.iterrows():
        thread_metrics = {}
        for col in df.columns:
            value = row[col]
            if pd.isna(value):
                continue
            matched_metric = next((m for m in known_metrics if col.endswith(m)), None)
            if matched_metric:
                thread = col[:-(len(matched_metric) + 1)]
                if thread not in thread_metrics:
                    thread_metrics[thread] = {}
                thread_metrics[thread][matched_metric] = value
            else:
                print(f"[influxdb_api.py] Unknown column skipped: {col}")

        for thread_name, metrics in thread_metrics.items():
            point = Point("entrust_metrics").tag("thread", thread_name)
            for metric_name, value in metrics.items():
                try:
                    point = point.field(metric_name, float(value))
                except ValueError:
                    continue
            write_api.write(bucket=bucket, org=config_influxdb.get('influxdb', 'INFLUXDB_ORG'), record=point)
    api_client.close()
    print(f"[influxdb_api.py] InfluxDB database populated.")
    return jsonify({"status": "success", "message": "CSV data ingested into InfluxDB"})

@app.route('/influxdb_entrust_tracer_visualization', methods=['GET'])
def influxdb_entrust_tracer_visualization():
    bucket_id = request.args.get('bucket')
    metric_suffix = request.args.get('metric')  # e.g. 'Memory_Usage_Percentage'
    start_time = request.args.get('start')
    end_time = request.args.get('end')

    print(f"[influxdb_api.py] ENTRUST: Fetching all *_{metric_suffix} from {bucket_id}")

    converted_start_time = start_time + ":00Z"
    converted_end_time = end_time + ":00Z"

    query_api = client.query_api()

    # Get all field keys in the bucket
    field_query = f'''
    import "influxdata/influxdb/schema"
    schema.fieldKeys(bucket: "{bucket_id}")
    '''
    field_result = query_api.query(org=config_influxdb.get('influxdb', 'INFLUXDB_ORG'), query=field_query)
    all_fields = [record.get_value() for table in field_result for record in table.records]

    # Filter fields that end with the chosen metric
    matching_fields = [f for f in all_fields if f.endswith(metric_suffix)]

    if not matching_fields:
        return jsonify({"error": "No matching fields found"}), 404

    field_filters = " or ".join([f'r._field == "{field}"' for field in matching_fields])

    flux_query = f'''
    from(bucket: "{bucket_id}")
    |> range(start: {converted_start_time}, stop: {converted_end_time})
    |> filter(fn: (r) => r._measurement == "entrust_metrics")
    |> filter(fn: (r) => r._field == "{metric_suffix}")
    '''

    print("[influxdb_api.py] Flux query:\n", flux_query)

    result = query_api.query(org=config_influxdb.get('influxdb', 'INFLUXDB_ORG'), query=flux_query)

    output = []
    for table in result:
        for record in table.records:
            output.append({
                "time": record.get_time(),
                "field": record.get_field(),
                "value": record.get_value(),
                "thread": record.values.get("thread", "unknown")
            })

    dashboard = create_grafana_dashboard_for_entrust(
        agent_id=bucket_id,
        matching_fields=matching_fields,
        start_time=converted_start_time,
        end_time=converted_end_time
    )

    return jsonify({
        "data": output,
        "grafanaUrl": dashboard['url']
    })


@app.route('/influxdb_telegraf_tracer_visualization', methods=['GET'])
def influxdb_telegraf_tracer_visualization():
    bucket_id = request.args.get('bucket')
    metrics = request.args.get('metrics')
    fields = request.args.get('fields')
    start_time = request.args.get('start')
    end_time = request.args.get('end')
    print("[influxdb_api.py] InfluxDB query requests "+ str(metrics) + " from Telegraf Tracer with id " + bucket_id)

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

    result = query_api.query(org=config_influxdb.get('influxdb','INFLUXDB_ORG'), query=query)
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
    grafana_token = config_grafana.get('grafana','GRAFANA_SERVICE_ACCOUNT_TOKEN')
    grafana_url = config_grafana.get('grafana','GRAFANA_URL')
    headers = {
        'Authorization': f'Bearer {grafana_token}',
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
        print(f"[influxdb_api.py] URL: {grafana_url}/api/dashboards/db")
        print("[influxdb_api.py] Headers:", headers)
        print("[influxdb_api.py] Payload:", dashboard)

        response = requests.post(f'{grafana_url}/api/dashboards/db', headers=headers, json=dashboard)
        response.raise_for_status()

        dashboard_data = response.json()
        print("[influxdb_api.py] Response from Grafana:", dashboard_data)

        dashboard_url = f"{grafana_url}/d/{dashboard_data['uid']}/{dashboard_data['slug']}"
        return {"url": dashboard_url}

    except requests.exceptions.HTTPError as http_err:
        print(f'[influxdb_api.py] HTTP error occurred: {http_err}')
        print(f'[influxdb_api.py] Response Content: {response.content}')
        if response.status_code == 412:
            print("[influxdb_api.py] Precondition Failed. Check if the payload is correct and the token has necessary permissions.")
    except Exception as err:
        print(f'[influxdb_api.py] Other error occurred: {err}')

    return {"url": None}


def create_grafana_dashboard_for_entrust(agent_id, matching_fields, start_time, end_time):
    grafana_token = config_grafana.get('grafana','GRAFANA_SERVICE_ACCOUNT_TOKEN')
    grafana_url = config_grafana.get('grafana','GRAFANA_URL')
    headers = {
        'Authorization': f'Bearer {grafana_token}',
        'Content-Type': 'application/json'
    }

    panels = []
    panel_id = 1

    for field in matching_fields:
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
                    "query": f'''
                    from(bucket:"{agent_id}")
                    |> range(start: {start_time}, stop: {end_time})
                    |> filter(fn: (r) => r._measurement == "entrust_metrics" and r._field == "{field}")
                    |> aggregateWindow(every: 1s, fn: mean, createEmpty: false)
                    |> group(columns: ["thread"])
                    '''
                }
            ],
            "gridPos": {
                "h": 8,
                "w": 12,
                "x": (panel_id % 2) * 12,
                "y": (panel_id // 2) * 9
            }
        }
        panels.append(panel)
        panel_id += 1

    dashboard = {
        "dashboard": {
            "title": f"ENTRUST Tracer Dashboard for {agent_id}",
            "tags": ["entrust"],
            "timezone": "browser",
            "panels": panels,
            "schemaVersion": 16,
            "version": 0,
            "refresh": "5s"
        },
        "overwrite": True
    }

    try:
        print("[influxdb_api.py] Creating ENTRUST dashboard...")
        response = requests.post(f'{grafana_url}/api/dashboards/db', headers=headers, json=dashboard)
        response.raise_for_status()
        dashboard_data = response.json()
        # Backend-internal Grafana URL
        internal_grafana_url = "http://entrust_grafana:3000"
        # Browser-facing URL override
        browser_grafana_url = "http://localhost:3100"
        dashboard_url = f"{browser_grafana_url}/d/{dashboard_data['uid']}/{dashboard_data['slug']}"
        return {"url": dashboard_url}

    except requests.exceptions.HTTPError as http_err:
        print(f'[influxdb_api.py] HTTP error occurred: {http_err}')
        print(f'[influxdb_api.py] Response Content: {response.content}')
    except Exception as err:
        print(f'[influxdb_api.py] Error occurred: {err}')

    return {"url": None}


@app.route('/influxdb_query_by_points', methods=['GET'])
def influxdb_query_by_points():
    try:
        bucket_id = request.args.get('bucket_id')
        number_points = request.args.get('number_points')
        asset_name = request.args.get('asset_name')
        print("[influxdb_api.py] InfluxDB query requests last "+ str(number_points) + " points from traced asset in bucket tracer_" + bucket_id)

        client = InfluxDBClient(url=config_influxdb.get('influxdb','INFLUXDB_URL'), token=config_influxdb.get('influxdb','INFLUXDB_TOKEN'), org=config_influxdb.get('influxdb','INFLUXDB_ORG'))
        query_api = client.query_api()

        # Query the last numPoints points from the specified bucket:
        query = f'''
        from(bucket: "tracer_{bucket_id}")
            |> range(start: -{number_points})
            |> sort(columns: ["timestamp"], desc: true) 
            |> limit(n: {number_points})
        '''
        result = query_api.query(org=config_influxdb.get('influxdb','INFLUXDB_ORG'), query=query)

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

@app.route('/influxdb_add_bucket', methods=['POST'])
def influxdb_add_bucket():
    data = request.get_json()
    bucket_id = data.get('bucket') if data else None
    if not bucket_id:
        return jsonify({"error": "Bucket ID is missing in the request."}), 400

    print("[influxdb_api.py] InfluxDB requested to add bucket with ID " + bucket_id)

    buckets_api = client.buckets_api()
    org_id = config_influxdb.get('influxdb', 'INFLUXDB_ORG')
    
    # Check if bucket already exists
    try:
        existing_buckets = buckets_api.find_buckets().buckets
        if any(b.name == bucket_id for b in existing_buckets):
            print(f"[influxdb_api.py] Bucket {bucket_id} already exists.")
            return jsonify({'status': 'Bucket already exists'}), 200

        # Create the bucket if it doesn't exist
        retention_rules = []
        bucket = buckets_api.create_bucket(
            bucket_name=bucket_id,
            org_id=org_id,
            retention_rules=retention_rules
        )

        print(f"[influxdb_api.py] Bucket {bucket.name} created.")

        # Call Grafana helper function
        # grafana_add_bucket(bucket_id) # TODO: UNCOMMENT WHEN GRAFANA FIXED

        return jsonify({'status': 'Bucket created'}), 200
    
    except Exception as e:
        print(f"[influxdb_api.py] Error creating bucket {bucket_id}: {e}")
        return jsonify({"error": str(e)}), 500

def grafana_add_bucket(bucket_id):
    grafana_url = config_grafana.get('grafana','GRAFANA_URL')
    grafana_token = config_grafana.get('grafana','GRAFANA_SERVICE_ACCOUNT_TOKEN')
    influx_url = config_influxdb.get("influxdb","INFLUXDB_URL")
    org_name = config_influxdb.get("influxdb","INFLUXDB_ORG")
    influx_token = config_influxdb.get("influxdb","INFLUXDB_TOKEN")
    influx_user = config_influxdb.get("influxdb","INFLUXDB_USER")
    influx_password = config_influxdb.get("influxdb","INFLUXDB_PASS")

    headers = {
        "Authorization": "Bearer " + grafana_token,  # use a Grafana service account token
        "Content-Type": "application/json"
    }

    payload = {
        "name": bucket_id,
        "type": "influxdb",
        "typeName":"InfluxDB",
        "access": "proxy",
        "url": influx_url,
        "basicAuth": False,
        "jsonData": {
            "version": "Flux",
            "organization": org_name,
            "defaultBucket": bucket_id
        },
        "secureJsonData": {
            "token": influx_token
        }
    }

    try:
        response = requests.post(grafana_url, headers=headers, json=payload)
        if response.status_code in [200, 201]:
            print(f"[influxdb_api.py] Grafana data source added: {bucket_id}")
        elif response.status_code == 409:
            print(f"[influxdb_api.py] Data source {bucket_id} already exists.")
        else:
            print(f"[influxdb_api.py] Failed to create data source: {response.status_code}")
    except Exception as e:
        print(f"[influxdb_api.py] Exception while creating data source: {e}")
    # TODO: MUST BE FIXED - NOT WORKING - 404 ERROR

def get_unique_filepath(directory, filename):
    base, ext = os.path.splitext(filename)
    file_path = os.path.join(directory, filename)
    
    counter = 1
    # Keep checking until the filename is unique
    while os.path.exists(file_path):
        new_filename = f"{base}_{counter}{ext}"
        file_path = os.path.join(directory, new_filename)
        counter += 1
    
    return file_path

@app.route('/influxdb_download_data', methods=['GET'])
def influxdb_download_data():
    bucket_id = request.args.get('endpoint')
    start_time = request.args.get('start')
    end_time = request.args.get('end')
    metric = request.args.get('metric')

    print("[influxdb_api.py] InfluxDB processes query from device with uid " + bucket_id + " from " + start_time + " to " + end_time)
    query_api = client.query_api()

    # TODO Convert date format to compatible one (Obs: UTC, if not UTC -> adjust!)
    converted_start_time = start_time + ":00Z"
    converted_end_time = end_time + ":00Z"

    print("[influxdb_api.py] Converted times: " + converted_start_time + " | " + converted_end_time)

    query = f"""
    from(bucket: "{bucket_id}")
    |> range(start: {converted_start_time}, stop: {converted_end_time})
    |> filter(fn: (r) => r._field == "{metric}")
    """
    print(query)

    # Execute the query
    try:
        result = query_api.query(org=config_influxdb.get("influxdb", "INFLUXDB_ORG"), query=query)
    except Exception as e:
        print(f"[influxdb_api.py] Query failed: {e}")
        return jsonify({"error": str(e)}), 500

    # Prepare data for CSV
    fieldnames_set = set()
    rows = []

    for table in result:
        for record in table.records:
            row = record.values.copy()
            row['time'] = record.get_time()
            rows.append(row)
            fieldnames_set.update(row.keys())

    fieldnames = sorted(fieldnames_set)

    # Define the CSV file path
    download_dir = './downloads'
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)

    filename = "data_selection.csv"
    file_path = get_unique_filepath(download_dir, filename)

    # Write to CSV
    with open(file_path, mode='w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    print(f"[influxdb_api.py] Query completed and CSV saved to {file_path}")
    # query_api.close()

    return jsonify({
        'file_path': file_path,
        'records_returned': len(rows)
    })

if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=False, port=5002)

