import React, { useEffect, useState } from 'react';
import { ChartProps } from '../Chart';
import axios from 'axios'


const DesignChart = (props: ChartProps) => {
  const { records } = props;
  const node = records && records[0] && records[0]._fields && records[0]._fields[0] ? records[0]._fields[0] : {};
  // const node_id = node.properties["uid"];

  const [deviceData, setDeviceData] = useState({
    name: '',
    tierLow: true,
    tierHigh: false,
    cpuRequest: '',
    memoryRequest: '',
    cpuLimit: '',
    memoryLimit: '',
    dockerImage: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
  
    // Prevent spaces in Device Name
    if (name === "name") {
      setDeviceData({ ...deviceData, name: value.replace(/\s/g, '') });
  
    // Tier toggle logic
    } else if (name === "tierLow") {
      setDeviceData({ ...deviceData, tierLow: true, tierHigh: false });
  
    } else if (name === "tierHigh") {
      setDeviceData({ ...deviceData, tierLow: false, tierHigh: true });
  
    // Only allow numeric values for CPU/Memory fields
    } else if (
      name === "cpuRequest" || name === "memoryRequest" ||
      name === "cpuLimit" || name === "memoryLimit"
    ) {
      if (/^\d*$/.test(value)) {  // Only digits allowed
        setDeviceData({ ...deviceData, [name]: value });
      }
  
    // Fallback for other fields (if any)
    } else {
      setDeviceData({ ...deviceData, [name]: value });
    }
  };

  // Function to submit the device data
  const createDeviceNode = async () => {
    const {
      name,
      cpuRequest,
      memoryRequest,
      cpuLimit,
      memoryLimit,
      dockerImage,
      tierLow
    } = deviceData;
    // Check if any required field is empty
    if (
      !name || !cpuRequest || !memoryRequest ||
      !cpuLimit || !memoryLimit || !dockerImage
    ) {
      alert('All fields must be filled in.');
      return;
    }
    try {
      const postData = {
        name: name,   
        cpuRequest: cpuRequest,     
        memRequest: memoryRequest,
        cpuLimit: cpuLimit,
        memLimit:  memoryLimit,
        dockerImage: dockerImage,
        tierLow: tierLow,
      };
      // console.log('[DesignChart.tsx] Post data:', postData);
      const response = await axios.post('http://localhost:5001/neo4j_add_node', postData);
      // Inspect response status and data
      // console.log('[DesignChart.tsx] Query response:', response);
      const bucket = 'design-' + response.data[0]['uid']
      await axios.post('http://localhost:5002/influxdb_add_bucket', { bucket: bucket});
      alert('Device added!');
    } catch (error) {
      console.error('[DesignChart.tsx] Error creating device node:', error);
      alert('Failed to create device node. See console.');
    }
  };

  const handleClearDesign = async () => {
    try {
      const response = await fetch('http://localhost:5001/neo4j_clear?phase=design', {
        method: 'DELETE',
      });
  
      if (response.ok) {
        alert('Design phase cleared!');
      } else {
        alert('Failed to clear design nodes.');
      }
    } catch (error) {
      console.error('[DesignChart.tsx] Error clearing:', error);
      alert('Server error. See console.');
    }
  };

  const handleDownloadYaml = async () => {
    try {
      const response = await fetch('http://localhost:5001/neo4j_download_yaml?phase=design', {
        method: 'GET',
      });
      if (response.ok) {
        alert('YAML file saved to "downloads" directory!');
      } else {
        alert('Failed to download YAML.');
      }
    } catch (error) {
      console.error('[DesignChart.tsx] Error downloading YAML:', error);
      alert('Failed to download YAML. See console.');
    }
  };

  return (
    <div style={{ marginTop: '0px', height: '100%', textAlign: 'center' }}>
      <h3>Create Device Node</h3>

      {/* Device Name */}
      <div style={{ marginBottom: '20px' }}>
        <label>Device Name:</label>
        <input
          type="text"
          name="name"
          placeholder="Enter device name (no spaces)"
          value={deviceData.name}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      {/* Tier Selection */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Select Tier</h4>
        <label style={{ marginRight: '10px' }}>
          <input
            type="checkbox"
            name="tierLow"
            checked={deviceData.tierLow}
            onChange={handleChange}
          />
          Low
        </label>

        <label>
          <input
            type="checkbox"
            name="tierHigh"
            checked={deviceData.tierHigh}
            onChange={handleChange}
          />
          High
        </label>
      </div>

      {/* CPU Request */}
      <div style={{ marginBottom: '20px' }}>
        <label>CPU Request:</label>
        <input
          type="text"
          name="cpuRequest"
          placeholder="e.g., 500m"
          value={deviceData.cpuRequest}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      {/* Memory Request */}
      <div style={{ marginBottom: '20px' }}>
        <label>Memory Request:</label>
        <input
          type="text"
          name="memoryRequest"
          placeholder="e.g., 512Mi"
          value={deviceData.memoryRequest}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      {/* CPU Limit */}
      <div style={{ marginBottom: '20px' }}>
        <label>CPU Limit:</label>
        <input
          type="text"
          name="cpuLimit"
          placeholder="e.g., 1"
          value={deviceData.cpuLimit}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      {/* Memory Limit */}
      <div style={{ marginBottom: '20px' }}>
        <label>Memory Limit:</label>
        <input
          type="text"
          name="memoryLimit"
          placeholder="e.g., 1Gi"
          value={deviceData.memoryLimit}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>Docker Image:</label>
        <input
          type="text"
          name="dockerImage"
          placeholder="e.g., your-user/your-image:tag"
          value={deviceData.dockerImage}
          onChange={handleChange}
          style={{ display: 'block', width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      {/* Submit Button */}
      <button
        style={{
          padding: '15px 20px',
          fontSize: '15px',
          cursor: 'pointer',
          marginTop: '20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          height: '45px'
        }}
        onClick={createDeviceNode}
      >
        Create Device Node
      </button>

      {/* Clear Button */}
      <button
        onClick={handleClearDesign}
        style={{
          padding: '15px 20px',
          fontSize: '15px',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginLeft: '10px',
          height: '45px'
        }}
      >
        Clear All
      </button>

      {/* Download YAML Button */}
      <button
        onClick={handleDownloadYaml}
        style={{
          padding: '15px 20px',
          fontSize: '15px',
          backgroundColor: '#708090',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          marginLeft: '10px',
          height: '45px'
        }}
      >
        Download YAML
      </button>
    </div>
  );
};

export default DesignChart;