import React, { useEffect, useState } from 'react';
import { ChartProps } from '../Chart';
import axios from 'axios';

const MisbehaviourChart = (props: ChartProps) => {
  const { records } = props;
  const node = records && records[0] && records[0]._fields && records[0]._fields[0] ? records[0]._fields[0] : {};
  const asset_id = node.properties["uid"];
  const asset_name_full = node.properties["name"];
  // console.log('[MisbehaviourChart.tsx] Clicked on ', asset_name_full);
  const asset_name = asset_name_full.split('_')[0];

  // Hold the state of checkboxes for monitored properties in columns:
  const [checkboxStates, setCheckboxStates] = useState({
    CPU: true,
    Memory_Usage_Percentage: false,
    Total_Memory: false,
    cycles: false,
    unused: false,
    usage: false,
    // TODO: Add more if necessary
  });

  // Hold state for inference number of points
  const [numberPoints, setNumberPoints] = useState('100');

  // Function to handle checkbox changes
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setCheckboxStates({
      ...checkboxStates,
      [name]: checked
    });
  };

  // Define a mapping of metric selections to model UUIDs
  const modelMapping = {
    CPU: "3b0a9e3f-e076-4713-81e1-e61cc8506406",
    Memory_Usage_Percentage: "model-uuid-for-memory-usage",
    Total_Memory: "model-uuid-for-total-memory",
    cycles: "fec9b630-3ebb-4264-8df7-4fe2e249ec65	",
    unused: "model-uuid-for-unused",
    usage: "model-uuid-for-usage",
    // Add more mappings as necessary
  };

  // Function to get the model UUID based on selected metrics
  const getModelUUID = (selectedMetrics) => {
    // In this example, assume you select the first metric's UUID as a placeholder
    // Modify the logic to handle combinations of metrics as needed
    const primaryMetric = selectedMetrics[0]; // Simple case: take the first selected metric
    return modelMapping[primaryMetric] || "default-model-uuid"; // Fallback to a default UUID
  };

  // Function to detect misbehaviour, activated by user pressing Detect button
  const detectMisbehaviour = async () => {
    const selectedMetrics = Object.keys(checkboxStates)
      .filter(key => checkboxStates[key])
      .map(metric => `${asset_name}_${metric}`);

    // Get the appropriate model UUID for the selected metrics
    const modelUUID = getModelUUID(selectedMetrics);

    // TODO-TRAIN: Construct the params.yaml content dynamically based on user input
    const paramsYaml = {
      featurize: {
        columns: selectedMetrics,
        convert_timestamp_to_datetime: false,
        dataset: 'entrust-dataset',
        overlap: 0,
        timestamp_column: 'timestamp',
        window_size: 10,
      },
      train: {
        annotations_dir: 'none',
        fix_predefined_centroids: false,
        learning_method: 'minibatchkmeans',
        max_iter: 100,
        n_clusters: 5,
        use_predefined_centroids: false,
      },
      postprocess: {
        min_segment_length: 1,
      }
    };
    try {
      // First, we save locally a user-defined last number of points on which the inference is done:
      const response_influxdb = await axios.get('http://localhost:5005/influxdb_query_by_points', {
        params: {
          bucket_id: asset_id,
          number_points: numberPoints,
          asset_name: asset_name
        }
      });
      console.log(response_influxdb.data);
      console.log('[MisbehaviourChart.tsx] Fetched user-defined inference data.');

      // Prepare the data for the /infer API
      const inferData = {
        param: {
          modeluid: modelUUID // Replace with your actual model UUID
        },
        scalar: {
          headers: ["timestamp", ...selectedMetrics], // Time plus selected metrics as headers
          data: response_influxdb.data.map(row => {
            return [row.timestamp, ...selectedMetrics.map(metric => row[metric])];
          })
        }
      };

      // Secondly, send the data to the /infer endpoint
      const response_udava = await axios.post('http://localhost:5000/infer', inferData);
      console.log(response_udava.data);
      console.log('[MisbehaviourChart.tsx] Fetched UDAVA results.');

    } catch (error) {
      console.error('[MisbehaviourChart.tsx] Error inferencing data:', error);
    }
  };

  return (
    <div style={{ marginTop: '0px', height: '100%', textAlign: 'center' }}>
     
      <h3>
        To access AI-based Misbehaviour Detection Module GUI, click <a href="http://localhost:5000/" target="_blank" rel="noopener noreferrer">HERE</a>.
      </h3>
    </div>
  );
};

export default MisbehaviourChart;
