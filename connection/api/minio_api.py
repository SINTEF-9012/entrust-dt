from flask import Flask, request, jsonify, Response
from minio_access import upload_object, create_bucket, get_last_object
import os
import datetime
import configparser
from typing import Dict, Any
import json


app = Flask(__name__)

# Note: <>_config.ini needs to be provided in advance and added to connection/api folder
config_minio = configparser.ConfigParser()
config_minio.read('minio_config.ini')

# Define a function to set the CORS headers
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'  # allowed origin
    response.headers['Access-Control-Allow-Methods'] = 'GET'  # Adjust as needed
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# Apply the CORS function to all routes using the after_request decorator
@app.after_request
def apply_cors(response):
    return add_cors_headers(response)

@app.route('/minio_upload_threat_model', methods=['POST'])
def minio_upload_threat_model():
    if 'file' not in request.files:
        return jsonify({'status': 400})
    file = request.files['file']
    bucket_name = config_minio.get('minio','threat_modelling_bucket_name')
    # Checks if bucket_name not present and creates it if not:
    create_bucket(bucket_name = bucket_name)
    print(f"[minio_api.py] Received request to load file {file.filename} to bucket {bucket_name}")
    # Store to database (make it available in the container): 
    temp_dir = "./downloads"
    if not os.path.exists(temp_dir):
        os.makedirs(temp_dir)
    file_name = file.filename
    file_path = os.path.join(temp_dir, file_name)
    file.save(file_path)
    try:
        # Upload file to MinIO
        upload_object(bucket_name, file_name, file_path)
        now = datetime.datetime.now()
    except Exception as e:
        return jsonify({'status': 500, 'error': 'Failed to upload to MinIO', 'details': str(e)}), 500
    finally:
        # Remove the temporary file after upload:
        if os.path.exists(file_path):
            os.remove(file_path)
    return jsonify({'status': 200, 'file_name':file_name, 'add_date':now.strftime("%Y-%m-%d %H:%M:%S"), 'format':file_name.split(".")[-1]})

def _extract_threats(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract threat information.
    """
    output: Dict[str, Any] = {}
    for entry in data.get("results", []):
        asset_name = entry.get("name")
        vulnerabilities = entry.get("vulnerabilities", [])
        # Ignore entries that aren’t assets (those that contain topology_analysis)
        if not asset_name or not isinstance(vulnerabilities, list):
            continue
        if asset_name not in output:
            output[asset_name] = {"threats": []}
        # Extract threats from each vulnerability
        for vuln in vulnerabilities:
            for threat in vuln.get("threats", []):
                threat_name = threat.get("name", "Unknown Threat")
                #description = threat.get("description", "")
                capec_ids = []
                mitigations = []
                for attr in threat.get("attributes", []):
                    if attr.get("key") == "capec":
                        capec_ids.extend(attr.get("value", []))
                    if attr.get("key") == "mitigations":
                        mitigations.extend(attr.get("value", []))
                # "description": description,
                output[asset_name]["threats"].append({
                    "name": threat_name,
                    "capec_ids": list(set(capec_ids)),
                    "mitigations": list(set(mitigations)),
                })
    return output

@app.route('/minio_get_last_threat_model', methods=['GET'])
def minio_get_last_threat_model():
    print("[minio_api.py] Received request for threat model.")
    bucket_name = config_minio.get('minio','threat_modelling_bucket_name')
    object_response = get_last_object(bucket_name=bucket_name)
    if object_response is None:
        print("[minio_api.py] Error retrieving threat model")
        return jsonify({"error": "No threat model found in bucket"}), 404
    try:
        threats_in_model = _extract_threats(object_response)
        print("[minio_api.py] Parsed threat model fetched.")
        return jsonify(threats_in_model)
    except Exception as e:
        print("[minio_api.py] Error decoding/parsing JSON:", e)
        return jsonify({"error": "Threat model file is not valid JSON"}), 400

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5003)
    