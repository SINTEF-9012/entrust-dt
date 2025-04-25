import pandas as pd
import datetime
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
import re
import configparser

config_influxdb = configparser.ConfigParser()
config_influxdb.read('influxdb_config.ini')

# (MANUAL) Load the CSV file
file_path = 'Data/filtered_normal.csv'
df = pd.read_csv(file_path)

# Function to determine if a value is an integer
def is_int(value):
    try:
        int(value)  # Try to convert to integer
        return True
    except ValueError:
        return False

# Filter the DataFrame to keep only rows where the 'timestamp' can be converted to an integer
df = df[df['timestamp'].apply(is_int)]

start_date = datetime.datetime(2024, 1, 1)  # Update to reference start date
df['timestamp'] = df['timestamp'].apply(lambda x: start_date + datetime.timedelta(seconds=int(x)))

# (MANUAL) Paste the output of API neo4j_get_devices (curl http://localhost:5001/neo4j_get_devices):
device_uids = [{"name":"EmptyKardinBLU1","uid":"97cb2fef-233c-4c48-affd-45cd0af5c298"},{"name":"EmptyKardinBLU2","uid":"41fb082b-162e-402e-bc50-b767f02de743"},{"name":"EmptyKardinBLU3","uid":"25c9e1e1-600f-492a-9db5-efdd0d7eddbe"},{"name":"KardinBLU","uid":"7f52b1ee-cce8-463b-9234-2b5f246bdd91"},{"name":"NordicDK","uid":"7cdbd5db-29b8-4035-a78d-3f20d92fdc7d"},{"name":"EmptyKardinBLU4","uid":"2f7a42b2-ffb1-48f4-9b5d-80789ed35942"},{"name":"EmptyGateway","uid":"a4106284-b421-4d5c-bd90-52c0ed967ba8"}]

# (MANUAL) Paste all metrics being monitored:
metrics = ["CPU", "cycles", "usage", "unused", "Total_Memory", "Memory_Usage_Percentage"]

# Regex pattern to find these metrics with any prefix
pattern = '|'.join(metrics)

# List to hold prefixes of matched column names
prefixes = [re.match(f"(.*)_(?:{pattern})", col).group(1) for col in df.columns if re.search(pattern, col)]

# Find threads:
threads = list(set(prefixes))

def filter_column_name(col, metrics):
    for metric in metrics:
        if metric in col:
            return metric
    return col

mapping_dict = {}

# Iterate over each thread and create a DataFrame for it
for thread in threads:
    # Select the columns related to the current asset and the timestamp
    columns = [col for col in df.columns if col.startswith(thread)]
    columns.append('timestamp')
    # Select thread-part of df:
    thread_df = df[columns]
    # Rename column name in the threadwise DataFrames:
    new_column_names = {col: filter_column_name(col, metrics) for col in thread_df.columns}
    # Renaming the columns in the DataFrame
    thread_df.rename(columns=new_column_names, inplace=True)
    # Map thread-part of df to thread:
    mapping_dict[thread] = thread_df

# print(mapping_dict)

# Your InfluxDB credentials
token = config_influxdb.get('influxdb','INFLUXDB_TOKEN')
org = config_influxdb.get('influxdb','INFLUXDB_ORG')
url = config_influxdb.get('influxdb','INFLUXDB_URL')

# Initialize InfluxDB client
client = InfluxDBClient(url=url, token=token, org=org)

# Function to convert DataFrame to InfluxDB line protocol format
def dataframe_to_influxdb(asset_df, bucket_name):
    points = []

    for index, row in asset_df.iterrows():
        timestamp = row['timestamp']

        # Create a point for each metric
        for col in asset_df.columns:
            if col != 'timestamp':
                point = Point('_'.join(col.split('_')[1:])) \
                    .tag("asset", col.split('_')[0]) \
                    .field("value", row[col]) \
                    .time(timestamp, WritePrecision.NS)
                points.append(point)

    # Write points to InfluxDB
    write_api = client.write_api(write_options=SYNCHRONOUS)
    write_api.write(bucket=bucket_name, org=org, record=points)

# Iterate over each asset and write data to its respective InfluxDB bucket
for thread, thread_df in mapping_dict.items():
    for device in device_uids:
        thread_uid = device["uid"]
        bucket_name = f"{thread}_{thread_uid}"
        # dataframe_to_influxdb(thread_df, bucket_name)