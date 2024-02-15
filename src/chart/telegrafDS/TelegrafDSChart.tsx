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
    system: false,
    IP: false,
    version: false,
    description: false,
    memory: false,
    disk: false,
    agent: false,
    docker: false,
    packages: false,
    CPU: false,
    internet: false,
    temperature: false
  });

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
      <h3>Device Properties</h3>
      {renderCheckbox('type')}
      {renderCheckbox('manufacturer')}
      {renderCheckbox('platform')}
      {renderCheckbox('system')}
      {renderCheckbox('IP')}
      {renderCheckbox('version')}
      {renderCheckbox('description')}
      {/* Render other Device Properties checkboxes */}

      <h3>Cyber Properties</h3>
      {renderCheckbox('memory')}
      {renderCheckbox('disk')}
      {renderCheckbox('agent')}
      {renderCheckbox('docker')}
      {renderCheckbox('packages')}
      {renderCheckbox('CPU')}
      {renderCheckbox('internet')}
      {/* Render other Cyber Properties checkboxes */}

      <h3>Physical Properties</h3>
      {renderCheckbox('temperature')}
      {/* Render other Physical Properties checkboxes */}

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
