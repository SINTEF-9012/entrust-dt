import React, { useState } from 'react';
import { ChartProps } from '../Chart';

const TelegrafDSChart = (props: ChartProps) => {
  const { records } = props;
  const node = records && records[0] && records[0]._fields && records[0]._fields[0] ? records[0]._fields[0] : {};

  // Unified state object to hold the status of all checkboxes
  const [checkboxStates, setCheckboxStates] = useState({
    type: false,
    manufacturer: false,
    platform: false,
    OS: false,
    IP: false,
    description: false,
    temperature: false,
    memory: false,
    system: false,
    disk: false,
    diskio: false,
    kernel: false,
    CPU: false,
    docker: false,
    ping: false,
    data: false
  });

  // State for date selection
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
      {renderCheckbox('type')}
      {renderCheckbox('manufacturer')}
      {renderCheckbox('platform')}
      {renderCheckbox('OS')}
      {renderCheckbox('IP')}
      {renderCheckbox('description')}
      {renderCheckbox('temperature')}
      {renderCheckbox('memory')}
      {renderCheckbox('system')}
      {renderCheckbox('disk')}
      {renderCheckbox('diskio')}
      {renderCheckbox('kernel')}
      {renderCheckbox('CPU')}
      {renderCheckbox('docker')}

      <h3>Device Properties</h3>
      {renderCheckbox('ping')}

      <h3>Device Data</h3>
      {renderCheckbox('data')}

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
      onClick={() => {/* Handle download action */}}>Download</button>
    </div>
  );
};

export default TelegrafDSChart;
