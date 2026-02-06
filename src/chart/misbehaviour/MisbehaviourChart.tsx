import React, { useEffect, useState } from 'react';
import { ChartProps } from '../Chart';
import axios from 'axios';

const MisbehaviourChart = (props: ChartProps) => {
  const { records } = props;
  const node = records && records[0] && records[0]._fields && records[0]._fields[0] ? records[0]._fields[0] : {};

  return (
    <div style={{ marginTop: '0px', height: '100%', textAlign: 'center' }}>
      <h3>
        Link to <a href="http://localhost:5000/" target="_blank" rel="noopener noreferrer">Misbehaviour Detection Module</a>.
      </h3>
    </div>
  );
};

export default MisbehaviourChart;
