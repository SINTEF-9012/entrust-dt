from flask import Flask, request, jsonify
from neo4j import GraphDatabase

app = Flask(__name__)

# Configure Neo4j connection - TODO: Create .ini file for this too.
url = "http://localhost:5000"  # URL of UDAVA

# Define a function to set the CORS headers
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = 'http://localhost:3000'  # allowed origin
    response.headers['Access-Control-Allow-Methods'] = 'OPTIONS, GET, POST'  # Adjust as needed
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

# Apply the CORS function to all routes using the after_request decorator
@app.after_request
def apply_cors(response):
    return add_cors_headers(response)

@app.route('/udava_inference', methods=['POST'])
def udava_inference():
    response_data = request.args.get('response')
    selection = request.args.get('selectedMetrics')
    print("[udava_api.py] Received request to infer on data.")
    # Manual mapping of selecteed metrics to models ids
    # TODO: Handle multivariate 
    metric_model_dict = {
        "idle_CPU" : "54f0d8b3-4e8e-4f70-93a7-182261d93f13",
        "logging_cycles" : "fec9b630-3ebb-4264-8df7-4fe2e249ec65",
        "logging_CPU" : "3b0a9e3f-e076-4713-81e1-e61cc8506406",
    }
    # TODO: Rest
    return jsonify( None)

if __name__ == '__main__':
    app.run(host="localhost", port=5006)