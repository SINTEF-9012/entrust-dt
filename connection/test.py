import requests


url = "http://localhost:5000/query_influxdb"

params = {
    gateway_id: "75f1f2d0-fd0c-403c-b034-84c3094fea28",
    metrics: "mem",
    start: "2024-04-19T13:09:00Z",
    end: "2024-04-19T13:26:00Z"
}

response = requests.get(url, params = params)
print(response.status_code)
print(response.text)

