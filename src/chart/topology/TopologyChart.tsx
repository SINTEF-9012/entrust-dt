import React, { useState } from 'react';
import { ChartProps } from '../Chart';
import axios from 'axios'

const TopologyChart = (props: ChartProps) => {
  const { records } = props;

  // Extract Device nodes
  const devices = records
    .map((record: any) => record._fields?.[0])
    .filter((node: any) => node?.labels?.includes('Device'));

  const [sourceDevice, setSourceDevice] = useState<string>('');
  const [targetDevice, setTargetDevice] = useState<string>('');
  const [deviceToDelete, setDeviceToDelete] = useState<string>("");
  // Loaded topology
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (sourceDevice && targetDevice) {
      const sourceDeviceObj = devices.find((d: any) => d.properties.uid === sourceDevice);
      const targetDeviceObj = devices.find((d: any) => d.properties.uid === targetDevice);
  
      const sourcePhase = sourceDeviceObj?.properties.phase;
      const targetPhase = targetDeviceObj?.properties.phase;
  
      try {
        const response = await fetch('http://localhost:5001/neo4j_add_relation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceUid: sourceDevice,
            targetUid: targetDevice,
            sourcePhase: sourcePhase,
            targetPhase: targetPhase,
          }),
        });
  
        const result = await response.json();
        // Add buckets if not present from before: 
        for (const item of result) {
          const bucket_s = 'predeployment-' + item.s.uid;
          await axios.post('http://localhost:5002/influxdb_add_bucket', { bucket: bucket_s });
        
          const bucket_t = 'predeployment-' + item.t.uid;
          await axios.post('http://localhost:5002/influxdb_add_bucket', { bucket: bucket_t });
        }
  
        if (response.ok) {
          console.log("[TopologyChart.tsx] Relationship created:", result);
          alert("Devices connected successfully!");
        } else {
          console.error("[TopologyChart.tsx] Error:", result);
          alert("Failed to connect devices.");
        }
      } catch (error) {
        console.error("[TopologyChart.tsx] Network error:", error);
        alert("Server error. Check console.");
      }
    }
  };

  const handleLoadTopologyClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click(); // Triggers hidden file input
    }
  };

  const handleLoadTopology = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result;
        if (!content) throw new Error("Empty file");
  
        const parsed = JSON.parse(content as string);
        console.log("[TopologyChart.tsx] Loaded topology JSON:", parsed);
  
        const response = await fetch('http://localhost:5001/neo4j_load_topology', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed),
        });
  
        if (response.ok) {
          const data = await response.json(); 
          const buckets = Object.values(data.buckets); 
          for (const bucket of buckets) {
            try {
              await axios.post('http://localhost:5002/influxdb_add_bucket', { bucket });
              console.log(`[TopologyChart.tsx] Bucket created: ${bucket}`);
            } catch (error) {
              console.error(`[TopologyChart.tsx] Failed to create bucket: ${bucket}`, error);
            }
          }
          alert("Topology loaded successfully!");
        } else {
          const errorData = await response.json();
          console.error("[TopologyChart.tsx] Load error:", errorData);
          alert("Failed to load topology.");
        }
      } catch (err) {
        console.error("Error reading or sending topology file:", err);
        alert("Error loading topology file.");
      }
    };
  
    reader.readAsText(file);
  };

  const handleDownloadTopology = async () => {
    console.log("[TopologyChart.tsx] Downloading topology...");
    try {
      const response = await fetch('http://localhost:5001/neo4j_download_topology');
      const blob = await response.blob();
    
    } catch (error) {
      console.error("[TopologyChart.tsx] Download error:", error);
      alert("Failed to download topology.");
    }
  };

  const handleClearAll = async () => {
    try {
      const response = await fetch('http://localhost:5001/neo4j_clear_all', {
        method: 'DELETE',
      });
      if (response.ok) {
        alert("All nodes and relationships removed!");
      } else {
        alert("Failed to clear graph.");
      }
    } catch (err) {
      console.error("[TopologyChart.tsx] Error clearing graph:", err);
      alert("Error clearing graph.");
    }
  };
  
  
  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return alert("Select a device.");
    try {
      const response = await fetch('http://localhost:5001/neo4j_delete_device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: deviceToDelete }),
      });
      if (response.ok) {
        alert("Device deleted successfully!");
      } else {
        alert("Failed to delete device.");
      }
    } catch (err) {
      console.error("[TopologyChart.tsx] Error deleting device:", err);
      alert("Error deleting node.");
    }
  };

  const handleDownloadYaml = async () => {
    try {
      const response = await fetch('http://localhost:5001/neo4j_download_yaml?phase=predeployment', {
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

  const isDisabled = !sourceDevice || !targetDevice;

  return (
    <div style={{ marginTop: '0px', height: '100%', textAlign: 'center' }}>
      <label style={{ display: 'block', marginBottom: '5px',  fontWeight: 'bold', fontSize: '16px' }}>Add Connection:</label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '40px',
          marginTop: '20px',
        }}
      >
        {/* Source Device Dropdown */}
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Source Device:</label>
          <select
            value={sourceDevice}
            onChange={(e) => setSourceDevice(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="">Select Source Device</option>
            {devices.map((device: any) => (
              <option key={device.properties.uid} value={device.properties.uid}>
                {device.properties.phase === 'design' ? '🔴' : '🔵'}{" "}
                {device.properties.name} ({device.properties.phase}, {device.properties.uid.slice(0, 6)}…)
              </option>
            ))}
          </select>
        </div>

        {/* CONNECT TO as Submit Button with Arrow */}
        <button
          onClick={handleSubmit}
          disabled={isDisabled}
          style={{
            position: 'relative',
            padding: '10px 30px',
            backgroundColor: isDisabled ? '#ccc' : '#007bff',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: '5px',
            border: 'none',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            marginTop: '22px',
            transition: 'background-color 0.3s',
          }}
        >
          CONNECT TO
          <div
            style={{
              position: 'absolute',
              top: '50%',
              right: '-15px',
              transform: 'translateY(-50%)',
              width: '0',
              height: '0',
              borderTop: '7px solid transparent',
              borderBottom: '7px solid transparent',
              borderLeft: `15px solid ${isDisabled ? '#ccc' : '#007bff'}`,
            }}
          ></div>
        </button>

        {/* Target Device Dropdown */}
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Target Device:</label>
          <select
            value={targetDevice}
            onChange={(e) => setTargetDevice(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="">Select Target Device</option>
            {devices.map((device: any) => (
              <option key={device.properties.uid} value={device.properties.uid}>
                {device.properties.phase === 'design' ? '🔴' : '🔵'}{" "}
                {device.properties.name} ({device.properties.phase}, {device.properties.uid.slice(0, 6)}…)
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Remove Specific Node */}
      <div style={{ marginTop: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '16px' }}>Delete Device:</label>

        {/* Flex container for dropdown + both buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          {/* Device Dropdown */}
          <select
            value={deviceToDelete}
            onChange={(e) => setDeviceToDelete(e.target.value)}
            style={{ width: '50%', padding: '10px' }}
          >
            <option value="">Select Device to Delete</option>
            {devices
              .filter((device: any) => device.properties.phase === 'predeployment')
              .map((device: any) => (
                <option key={device.properties.uid} value={device.properties.uid}>
                  🔵 {device.properties.name} (predeployment, {device.properties.uid.slice(0, 6)}…)
                </option>
              ))}
          </select>

          {/* Remove Device Button */}
          <button
            onClick={handleDeleteDevice}
            style={{
              padding: '10px 20px',
              backgroundColor: '#ffc107',
              color: 'white',
              fontWeight: 'bold',
              borderRadius: '5px',
              border: 'none',
              cursor: 'pointer',
              height: '35px',
            }}
          >
            Remove Device
          </button>

          {/* Clear All Button */}
          <button
            onClick={handleClearAll}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              fontWeight: 'bold',
              borderRadius: '5px',
              border: 'none',
              cursor: 'pointer',
              height: '35px',
            }}
          >
            Clear All
          </button>
        </div>
      </div>
      {/* Download + Load Topology Buttons */}
      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
        {/* Download */}
        <button
          onClick={handleDownloadTopology}
          style={{
            padding: '10px 20px',
            backgroundColor: '#708090',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: '5px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Download Topology
        </button>

        {/* Load */}
        <button
          onClick={handleLoadTopologyClick}
          style={{
            padding: '10px 20px',
            backgroundColor: '#708090',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: '5px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Load Topology
        </button>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.graphml"
          onChange={handleLoadTopology}
          style={{ display: 'none' }}
        />

        {/* Download YAML Button */}
        <button
          onClick={handleDownloadYaml}
          style={{
            padding: '10px 20px',
            backgroundColor: '#708090',
            color: 'white',
            fontWeight: 'bold',
            borderRadius: '5px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Download YAML
        </button>
      </div>
    </div>
  );
};

export default TopologyChart;
