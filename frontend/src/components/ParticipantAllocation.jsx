import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function ParticipantAllocation({ simulationState }) {
  const { currentUser } = useAuth();
  const [allocation, setAllocation] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inputs, setInputs] = useState({
    "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0
  });

  const assetNames = {
    "1": "Asset Class 1",
    "2": "Asset Class 2",
    "3": "Asset Class 3",
    "4": "Government Securities",
    "5": "Bank Fixed Deposits",
    "6": "Real Estate",
    "7": "Gold"
  };

  useEffect(() => {
    fetchAllocation();
  }, []);

  const fetchAllocation = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await currentUser.getIdToken();
      const [allocationRes, teamRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/allocation`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/team`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const data = await allocationRes.json();
      if (!allocationRes.ok) {
        throw new Error(data.error || 'Failed to fetch allocation');
      }

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        if (teamData.team) {
          setTeamName(teamData.team.name);
        }
      }

      setAllocation(data);
      if (data.allocations) {
        setInputs(data.allocations);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key, value) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;
    setInputs(prev => ({ ...prev, [key]: numValue }));
  };

  const handleSaveDraft = async () => {
    try {
      setError('');
      setSuccess('');
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/allocation`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ allocations: inputs })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save draft');
      }

      setSuccess('Draft saved successfully.');
      fetchAllocation();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm('Are you sure you want to submit? This action cannot be undone.')) {
      return;
    }
    
    try {
      setError('');
      setSuccess('');
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/allocation/submit`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ allocations: inputs })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit allocation');
      }

      setSuccess('Initial allocation submitted successfully.');
      fetchAllocation();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="bmc-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading initial allocation workbench...</span>
        </div>
      </div>
    );
  }

  if (error === 'You are not assigned to a team.') {
    return (
      <div className="bmc-card">
        <div className="bmc-card-header">
          <h3 className="bmc-card-title">Initial Portfolio Allocation</h3>
        </div>
        <div className="alert alert-warning">
          <span>You are not assigned to a team yet. Please wait for an administrator to assign your squad.</span>
        </div>
      </div>
    );
  }

  // Only show this component during Round 0 ALLOCATION phase
  if (simulationState && (simulationState.currentRound !== 0 || simulationState.status !== 'ALLOCATION')) {
    return null;
  }

  const isSubmitted = allocation?.status === 'SUBMITTED';
  const totalAllocated = Object.values(inputs).reduce((sum, val) => sum + (val || 0), 0);
  const unallocated = 1000000 - totalAllocated;
  const percentAllocated = Math.min(100, Math.max(0, (totalAllocated / 1000000) * 100));
  const isOverBudget = unallocated < 0;

  return (
    <div className="bmc-card">
      <div className="bmc-card-header">
        <div>
          <h3 className="bmc-card-title">
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--warning-light)',
              fontSize: '0.85rem'
            }}>
              ⚖️
            </span>
            Initial Portfolio Allocation (Round 0)
          </h3>
          <p className="bmc-card-subtitle">
            Deploy starting capital of ₹10,00,000 for {teamName || 'your squad'} across the 7 asset classes before the round window closes.
          </p>
        </div>
        <span className={`badge ${isSubmitted ? 'badge-running' : 'badge-allocation'}`}>
          <span className="badge-dot" />
          {isSubmitted ? 'Status: SUBMITTED (Locked)' : 'Phase: ALLOCATION OPEN'}
        </span>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span><strong>Allocation Error:</strong> {error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success" role="status">
          <span>{success}</span>
        </div>
      )}

      {isSubmitted && (
        <div className="alert alert-info">
          <span>
            <strong>Allocation Locked:</strong> Your initial allocation of ₹{totalAllocated.toLocaleString('en-IN')} has been finalized and submitted to the trading engine.
          </span>
        </div>
      )}

      {/* Budget Summary Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        padding: '1.25rem',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        marginBottom: '1.5rem'
      }}>
        <div>
          <span className="bmc-stat-label">Starting Capital</span>
          <div className="bmc-stat-value" style={{ fontSize: '1.35rem' }}>₹10,00,000</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Initial allocation pool</span>
        </div>
        <div>
          <span className="bmc-stat-label">Allocated Capital</span>
          <div className="bmc-stat-value" style={{ fontSize: '1.35rem', color: isOverBudget ? 'var(--loss-light)' : 'var(--accent-electric)' }}>
            ₹{totalAllocated.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{percentAllocated.toFixed(1)}% of total capital</span>
        </div>
        <div>
          <span className="bmc-stat-label">Remaining Unallocated (Cash)</span>
          <div className="bmc-stat-value" style={{
            fontSize: '1.35rem',
            color: isOverBudget ? 'var(--loss-light)' : 'var(--gain-light)'
          }}>
            ₹{unallocated.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.75rem', color: isOverBudget ? 'var(--loss-light)' : 'var(--text-muted)' }}>
            {isOverBudget ? 'Exceeds ₹10,00,000 limit!' : 'Kept as liquid reserve'}
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
          <span>Capital Deployed</span>
          <span>{percentAllocated.toFixed(1)}%</span>
        </div>
        <div className="progress-track">
          <div 
            className={`progress-bar ${isOverBudget ? 'progress-bar-danger' : 'progress-bar-electric'}`}
            style={{ 
              width: `${Math.min(100, percentAllocated)}%`,
              backgroundColor: isOverBudget ? 'var(--loss-red)' : undefined
            }}
          />
        </div>
      </div>

      {/* Allocation Inputs Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>Asset Class</th>
              <th style={{ width: '35%' }}>Allocation Amount (₹)</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Weight</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(assetNames).map(([key, name]) => {
              const val = inputs[key] || 0;
              const weight = totalAllocated > 0 ? ((val / 1000000) * 100).toFixed(1) : '0.0';
              return (
                <tr key={key}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {name}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '220px' }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>₹</span>
                      <input 
                        type="number" 
                        min="0"
                        step="1"
                        value={inputs[key] === 0 ? '' : inputs[key]} 
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        disabled={isSubmitted}
                        className="form-input form-input-mono"
                        style={{ padding: '0.45rem 0.65rem' }}
                        placeholder="0"
                        aria-label={`Allocation amount for ${name}`}
                      />
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {weight}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      {!isSubmitted && (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={handleSaveDraft}
            className="btn btn-secondary"
          >
            💾 Save Draft
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={isOverBudget}
            className="btn btn-success"
          >
            🚀 Submit Final Allocation
          </button>
        </div>
      )}
    </div>
  );
}

export default ParticipantAllocation;
