import React, { useState } from 'react'; 
import { ChartProps } from '../Chart';
import axios from 'axios';

const AttackChart = (props: ChartProps) => {
  const { records } = props;
  const node =
    records && records[0] && records[0]._fields && records[0]._fields[0]
      ? records[0]._fields[0]
      : {};

  // Possible attack types
  const attackOptions = [
    { key: 'dos', label: 'Denial of Service (DoS)' },
    { key: 'brute_force', label: 'Brute Force' },
    { key: 'injection', label: 'Injection Attack' },
    { key: 'rop', label: 'Return-Oriented Programming (ROP)' },
    // TODO: Add more here
  ];

  // Track the currently selected attack
  const [selectedAttack, setSelectedAttack] = useState<string | null>('dos');

  const handleAttackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedAttack(e.target.value);
  };

  const handleGenerateScripts = async () => {
    if (!selectedAttack) {
      alert('Please select an attack first.');
      return;
    }
    console.log('Generating scripts for:', selectedAttack);
    alert(`Generating attack scripts for: ${selectedAttack}`);

    // Later -> backend call
    // await axios.post("http://localhost:5000/generate_attack", { attack: selectedAttack, node });
  };

  return (
    <div style={{ marginTop: '10px', height: '100%', textAlign: 'center' }}>
      <h3 style={{ marginBottom: '20px' }}> Attack Simulation Setup</h3>

      <div
        style={{
          display: 'inline-block',
          padding: '15px 20px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          textAlign: 'left',
          backgroundColor: '#fafafa',
          minWidth: '280px'
        }}
      >
        {attackOptions.map((attack) => (
          <div
            key={attack.key}
            style={{
              marginBottom: '12px',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <input
              type="radio"
              id={attack.key}
              name="attack"
              value={attack.key}
              checked={selectedAttack === attack.key}
              onChange={handleAttackChange}
              style={{ marginRight: '8px' }}
            />
            <label htmlFor={attack.key}>{attack.label}</label>
          </div>
        ))}

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 500
            }}
            onClick={handleGenerateScripts}
          >
            Generate Attack Scripts
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttackChart;
