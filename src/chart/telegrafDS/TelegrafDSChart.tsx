import React, { useEffect, useState } from 'react';
import { ChartProps } from '../Chart';
import axios from 'axios';
import { formatISO } from 'date-fns';

const TelegrafDSChart = (props: ChartProps) => {
  const { records } = props;
  const node = records && records[0] && records[0]._fields && records[0]._fields[0] ? records[0]._fields[0] : {};
  const agent_id = node.properties["uid"];
  console.log('[TelegrafDSChart.tsx] Monitoring agent with ID ', agent_id);

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

  // Hold state for date selection
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Hold state for analyzed data
  const [analyzedData, setAnalyzedData] = useState(null);
  // Hold state for grafana URL
  const [grafanaUrl, setGrafanaUrl] = useState('');

  // Function to analyze data, activated by user pressing Analyze button
  const analyzeData = async () => {
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
        const response = await axios.get('http://localhost:5000/influxdb_query_process', {
            params: {
                agent_id: agent_id,
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
        console.log('[TelegrafDSChart.tsx] Fetched user-defined data.');
    } catch (error) {
        console.error('[TelegrafDSChart.tsx] Error fetching data:', error);
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
    <div style={{ marginTop: '0px', height: '100%', textAlign: 'center' }}>
      <h3>Select Telegraf Plugins</h3>
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
        onClick={analyzeData}
      >
        Analyze
      </button>
      <h3>Telegraf Data Visualization</h3>
      {grafanaUrl && (
      <div style={{ marginTop: '20px' }}>
        <iframe src={grafanaUrl} width="100%" height="500px" frameBorder="0"></iframe>
      </div>
    )}
    </div>
  );
};

export default TelegrafDSChart;
