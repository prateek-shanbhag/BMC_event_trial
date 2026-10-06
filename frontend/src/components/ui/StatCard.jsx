import React from 'react';
import { Card } from './Card';
import { Badge } from './Badge';
import './ui.css';

export const StatCard = ({ title, value, change, changeType, className = '' }) => {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-card-header text-label-caps">{title}</div>
      <div className="stat-card-body">
        <div className="stat-card-value text-headline-lg tabular-nums">{value}</div>
        {change && (
          <Badge variant={changeType || 'neutral'} className="stat-card-change">
            {changeType === 'positive' && '▲ '}
            {changeType === 'negative' && '▼ '}
            {change}
          </Badge>
        )}
      </div>
    </div>
  );
};
