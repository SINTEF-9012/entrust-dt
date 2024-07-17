import React, { useEffect, useState } from 'react';
import { ChartProps } from '../Chart';
import axios from 'axios';
import { formatISO } from 'date-fns';

const TelegrafDSChart = (props: ChartProps) => {
  const { records } = props;
  const node = records && records[0] && records[0]._fields && records[0]._fields[0] ? records[0]._fields[0] : {};
  const agent_id = node.properties["uid"];
  // Hold the status of checkboxes:
  const [checkboxStates, setCheckboxStates] = useState({
    exec: false,
    temp: false,
    mem: false,
    ping: false,
  });
  // Hold state for date selection
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Hold state for gateway ID
  const [gateway_id, setGatewayId] = useState('');
  // Fetch ID at mounting
  useEffect(() => {
    const fetchId = async () => {
      try {
        if (agent_id) { // Ensure agent_id is not undefined
          const response = await axios.get('http://localhost:5001/neo4j_get_gateway_id', {
            params: { agent_id: agent_id } // Send agent_id as a query parameter
          });
          setGatewayId(response.data); // Assuming the gateway_id is directly in the response
          console.log('[TelegrafDSChart.tsx] Fetched gateway id:', response.data);
        }
      } catch (error) {
        console.error('[TelegrafDSChart.tsx] Error in fetching gateway id:', error);
      }
    };

    fetchId();
  }, [agent_id]); // Include agent_id in the dependency array

  // Function to analyze data, activated by user pressing Analyze button
  const analyzeData = async () => {
    const selectedMetrics = Object.keys(checkboxStates).filter(key => checkboxStates[key]);
    try {
      const response = await axios.get('http://localhost:5000/influxdb_query_process', {
        params: {
          gateway_id: gateway_id,
          metrics: selectedMetrics.join(','), // Assuming metrics is an array
          start: startDate,
          end: endDate
        } 
      });
      console.log(response.data); // For now, just log the response
      console.log('[TelegrafDSChart.tsx] Fetched user-defined data.');
    } catch (error) {
      console.error('[TelegrafDSChart.tsx] Error fetching data:', error);
    }
  };


  // Function to handle checkbox changes
  const handleCheckboxChange = (propertyName, value) => {
    setCheckboxStates(prevState => ({
      ...prevState,
      [propertyName]: value
    }));
    // Optional: Update backend with new state
  };

  // Function to render a checkbox
  const renderCheckbox = (propertyName) => {
    return (
      <div style={{ marginBottom: '10px' }}>
        <label>
          <input
            type="checkbox"
            checked={checkboxStates[propertyName]}
            onChange={(e) => handleCheckboxChange(propertyName, e.target.checked)}
          />
          {propertyName.charAt(0).toUpperCase() + propertyName.slice(1)}
        </label>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '0px', height: '100%', textAlign: 'center' }}>

      <h3>Gateway Properties</h3>
      {renderCheckbox('exec')}
      {renderCheckbox('temp')}
      {renderCheckbox('mem')}

      <h3>Device Properties</h3>
      {renderCheckbox('ping')}

      <div style={{ marginTop: '20px' }}>
        <h4>Select Time Frame</h4>
        <div>
          <label>Start: </label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label>End: </label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <button 
        style={{ 
          padding: '15px 25px', 
          fontSize: '20px', 
          cursor: 'pointer',
          marginTop: '20px'
        }} 
        onClick={analyzeData}
      >
        Analyze
      </button>
    </div>
  );
};

export default TelegrafDSChart;
