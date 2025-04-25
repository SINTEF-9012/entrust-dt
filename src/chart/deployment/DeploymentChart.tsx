import React from 'react';
import { ChartProps } from '../Chart';
import axios from 'axios'

const DeploymentChart = (props: ChartProps) => {
  const handleSubmit = async () => {
    try {
      const response = await fetch('http://localhost:5001/neo4j_deployment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deploy' }), // You can send more later
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
        alert('Connected devices deployed successfully!');
      } else {
        alert('Deployment failed.');
      }
    } catch (error) {
      console.error('[DeploymentChart.tsx] Error during deployment:', error);
      alert('Server error. Check console.');
    }
  };

  const handleClearRuntime = async () => {
    try {
      const response = await fetch('http://localhost:5001/neo4j_clear?phase=runtime', {
        method: 'DELETE',
      });
  
      if (response.ok) {
        alert('Runtime phase cleared!');
      } else {
        alert('Failed to clear runtime nodes.');
      }
    } catch (error) {
      console.error('[DeploymentChart.tsx] Error clearing runtime:', error);
      alert('Server error. See console.');
    }
  };

  const handleDownloadYaml = async () => {
    try {
      const response = await fetch('http://localhost:5001/neo4j_download_yaml?phase=runtime', {
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
    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '20px' }}>
      {/* Deploy Devices Button */}
      <button
        onClick={handleSubmit}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Deploy Devices
      </button>
  
      {/* Clear Runtime Button */}
      <button
        onClick={handleClearRuntime}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Clear All
      </button>

      {/* Download YAML Button 
      <button
        onClick={handleDownloadYaml}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          backgroundColor: '#708090',
        }}
      >
        Download YAML
      </button>
      */}
    </div>
  );
};

export default DeploymentChart;

