import React, { useEffect, useState } from 'react';
import { ChartProps } from '../Chart';
import axios from 'axios';
import { formatISO } from 'date-fns';

const TracerChart = (props: ChartProps) => {
  const { records } = props;
  const node = records && records[0] && records[0]._fields && records[0]._fields[0] ? records[0]._fields[0] : {};
  const agent_id = node.properties["uid"];
  const bucket = node.properties["bucket"];
  // console.log('[TracerChart.tsx] Tracer with ID ', agent_id);

  // Hold the state of chosen metrics for ENTRUST Tracer
  const [entrustMetric, setEntrustMetric] = useState('');
  // Hold the state of high-level checkboxes (i.e list Telegraf input plugin):
  const [checkboxStates, setCheckboxStates] = useState({
    mem: false,
    temp: false,
    // TODO: Add more input plugins here & in return statement 
  });
  // Hold the state of low-level checkboxes (i.e list Telegraf input plugin fields):
  const [metricFields, setMetricFields] = useState({
    mem: {
      active: false,
      available: false,
      available_percent: false,
      buffered: false,
      cached: false,
      free: false,
      total: false,
      used: false,
      used_percent: false,
    },
    temp: {
      temp: false,
    }
    // TODO: Add more input plugins and fields here & in return statement 
  });

  // Telegraf: Hold state for date selection
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Telegraf: Hold state for analyzed data
  const [analyzedData, setAnalyzedData] = useState(null);
  // Telegraf: Hold state for grafana URL
  const [grafanaUrl, setGrafanaUrl] = useState('');
  // ENTRUST Tracer: Hold state for date selection
  const [entrustStartDate, setEntrustStartDate] = useState('');
  const [entrustEndDate, setEntrustEndDate] = useState('');
  // ENTRUST Tracer: Hold state for grafana URL
  const [entrustGrafanaUrl, setEntrustGrafanaUrl] = useState('');


  // Function to visualize data, activated by user pressing Visualize button
  const visualizeData = async () => {
    const selectedMetrics = Object.keys(checkboxStates).filter(key => checkboxStates[key]);
    const selectedFields = [];
    selectedMetrics.forEach(metric => {
        if (checkboxStates[metric]) {
            // If high-level metric is checked, include all its subfields
            const allFieldsSelected = Object.keys(metricFields[metric]).every(field => metricFields[metric][field]);
            if (allFieldsSelected || !Object.keys(metricFields[metric]).some(field => metricFields[metric][field])) {
                selectedFields.push(...Object.keys(metricFields[metric]).map(field => `${metric}.${field}`));
            } else {
                // Include only the selected subfields
                Object.keys(metricFields[metric]).forEach(field => {
                    if (metricFields[metric][field]) {
                        selectedFields.push(`${metric}.${field}`);
                    }
                });
            }
        }
    });
    try {
        const response = await axios.get('http://localhost:5002/influxdb_telegraf_tracer_visualization', {
            params: {
                bucket: bucket,
                metrics: selectedMetrics.join(','),
                fields: selectedFields.join(','),
                start: startDate,
                end: endDate
            }
        });
        setAnalyzedData(response.data); // Store analyzed data
        const grafanaUrl = response.data.grafanaUrl; // Assuming the response contains a field grafanaUrl
        setGrafanaUrl(grafanaUrl); // Set the state with the Grafana URL
        console.log(response.data);
        console.log('[TracerChart.tsx] Fetched user-defined data.');
    } catch (error) {
        console.error('[TracerChart.tsx] Error fetching data:', error);
    }
  };

  const visualizeEntrustData = async () => {
    try {
      const response = await axios.get('http://localhost:5002/influxdb_entrust_tracer_visualization', {
        params: {
          bucket: bucket,
          metric: entrustMetric,
          start: entrustStartDate,
          end: entrustEndDate
        }
      });
      setEntrustGrafanaUrl(response.data.grafanaUrl); // Assuming backend returns this
      console.log('[TracerChart.tsx] ENTRUST tracer data:', response.data);
    } catch (error) {
      console.error('[TracerChart.tsx] Error fetching ENTRUST tracer data:', error);
    }
  };  

  const downloadEntrustData = async () => {
    try {
      const response = await axios.get('http://localhost:5002/influxdb_download_data', {
        params: {
          endpoint: bucket,
          start: entrustStartDate,
          end: entrustEndDate,
          metric: entrustMetric
        } 
      });
      console.log('[TracerChart.tsx] Fetched user-defined data.');
      console.log(response.data); // For now, just log the response
    } catch (error) {
      console.error('[TracerChart.tsx] Error fetching data:', error);
    }
  };  

  // Function to handle checkbox changes
  const handleCheckboxChange = (propertyName, value, field = null) => {
    if (field) {
      setMetricFields(prevState => ({
        ...prevState,
        [propertyName]: {
          ...prevState[propertyName],
          [field]: value
        }
      }));
    } else {
      setCheckboxStates(prevState => ({
        ...prevState,
        [propertyName]: value
      }));
    }
  };

  // Function to render a checkbox
  const renderCheckbox = (propertyName, field = null) => {
    const isChecked = field ? metricFields[propertyName][field] : checkboxStates[propertyName];
    const label = field ? `${propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}.${field}` : propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
    const labelStyle = field ? {} : { fontWeight: 'bold' };

    return (
      <div style={{ marginBottom: '10px' }}>
        <label>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => handleCheckboxChange(propertyName, e.target.checked, field)}
          />
          <span style={labelStyle}>{label}</span>
        </label>
      </div>
    );
  };

  const renderSubCheckboxes = (metricName) => {
    return Object.keys(metricFields[metricName]).map(field => renderCheckbox(metricName, field));
  };

  return (
    <div style={{ marginTop: '0px', height: '100%', textAlign: 'center', padding: '20px' }}>
      {/* ────── TELEGRAF SECTION ────── 
      <div style={{ border: '1px solid #ccc', borderRadius: '10px', padding: '20px', marginBottom: '40px' }}>
        <h2>Telegraf Tracer Metrics</h2>
        <p>Select which Telegraf plugins and fields to visualize:</p>
  
        {renderCheckbox('temp')}
        {checkboxStates['temp'] && renderSubCheckboxes('temp')}
        {renderCheckbox('mem')}
        {checkboxStates['mem'] && renderSubCheckboxes('mem')}
  
        <div style={{ marginTop: '20px' }}>
          <h3>Select Time Frame</h3>
          <div>
            <label>Start (UTC Timezone): </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label>End (UTC Timezone): </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
  
        <button
          style={{
            padding: '15px 20px',
            fontSize: '15px',
            cursor: 'pointer',
            marginTop: '20px'
          }}
          onClick={visualizeData}
        >
          Visualize
        </button>
  
        {grafanaUrl && (
          <div style={{ marginTop: '30px' }}>
            <h3>Telegraf Data Visualization</h3>
            <iframe src={grafanaUrl} width="100%" height="500px" frameBorder="0"></iframe>
          </div>
        )}
      </div>
      */}
      {/* ────── ENTRUST SECTION ────── */}
      {/* Upload Section Box */}
      <div style={{ border: '1px solid #aaa', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
        <h2> Upload Tracer Data (.CSV)</h2>
        <input 
          type="file" 
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('bucket', bucket);

              axios.post('http://localhost:5002/influxdb_populate', formData, {
                headers: {
                  'Content-Type': 'multipart/form-data',
                }
              }).then(res => {
                alert('CSV uploaded successfully');
                console.log('[TracerChart.tsx] Upload success:', res.data);
              }).catch(err => {
                alert('CSV upload failed');
                console.error('[TracerChart.tsx] Upload error:', err);
              });
            }
          }}
        />
      </div>

      {/* Main Tracer Selection Box */}
      <div style={{ border: '1px solid #aaa', borderRadius: '10px', padding: '20px' }}>
        <h2> Tracer Data Selection </h2>
        <p>Select a metric and time frame:</p>

        <div style={{ marginBottom: '15px' }}>
          <label>Select Metric:</label>
          <select
            value={entrustMetric}
            onChange={(e) => setEntrustMetric(e.target.value)}
            style={{ marginLeft: '10px' }}
          >
            <option value="">-- Select a Metric --</option>
            <option value="CPU">CPU Utilization</option>
            <option value="cycles">CPU Cycles</option>
            <option value="Memory_Usage_Percentage">Percentage of Memory Used</option>
            <option value="Total_Memory">Total Memory</option>
            <option value="usage">Used Memory</option>
            <option value="unused">Unused Memory</option>
          </select>
        </div>

        <div>
          <label>Start (UTC Timezone): </label>
          <input
            type="datetime-local"
            value={entrustStartDate}
            onChange={(e) => setEntrustStartDate(e.target.value)}
          />
        </div>
        <div>
          <label>End (UTC Timezone): </label>
          <input
            type="datetime-local"
            value={entrustEndDate}
            onChange={(e) => setEntrustEndDate(e.target.value)}
          />
        </div>
         {/* Tracer Visualization Option 
        <h2> Tracer Data Visualization </h2>
        <button
          style={{
            padding: '12px 18px',
            fontSize: '14px',
            cursor: 'pointer',
            marginTop: '5px'
          }}
          onClick={visualizeEntrustData}
          disabled={!entrustMetric}
        >
          Visualize
        </button> */}

        <h2> Tracer Data Download </h2>
        <button
          style={{
            padding: '12px 18px',
            fontSize: '14px',
            cursor: 'pointer',
            marginTop: '5px'
          }}
          onClick={downloadEntrustData}
          disabled={!entrustMetric}
        >
          Download Selection
        </button>

        {entrustGrafanaUrl && (
          <div style={{ marginTop: '30px' }}>
            <h3> Grafana View for Selection </h3>
            <iframe src={entrustGrafanaUrl} width="100%" height="500px" frameBorder="0"></iframe>
          </div>
        )}
      </div>
    </div>
  );  
};

export default TracerChart;
