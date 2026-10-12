import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function SimulationControl() {
  const { currentUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSimulationState();
  }, []);

  const fetchSimulationState = async () => {
    try {
      setError('');
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/simulation`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch simulation state');
      }
      const data = await response.json();
      setConfig(data);
    } catch (err) {
      console.error(err);
      setError('Could not load simulation configuration.');
    }
  };

  const handleAction = async (endpoint, successMsg) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/simulation/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to execute ${endpoint}`);
      }
      
      setSuccess(successMsg);
      await fetchSimulationState();
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to completely RESET the simulation lifecycle back to SETUP? This does NOT delete teams, users, or news, but starts the simulation process over from Round 0.")) {
      handleAction('reset', 'Simulation reset to SETUP successfully.');
    }
  };

  if (!config) {
    return (
      <div className="bmc-card">
        <div className="bmc-card-header">
          <h3 className="bmc-card-title">Simulation Lifecycle Engine</h3>
        </div>
        {error ? (
          <div className="alert alert-error" role="alert">{error}</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading simulation engine parameters...</span>
          </div>
        )}
      </div>
    );
  }

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'SETUP': return 'badge-setup';
      case 'ALLOCATION': return 'badge-allocation';
      case 'RUNNING': return 'badge-running';
      case 'FINISHED': return 'badge-finished';
      default: return 'badge-setup';
    }
  };

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
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--accent-electric)',
              fontSize: '0.85rem'
            }}>
              ⚙️
            </span>
            Simulation Control & Round Engine
          </h3>
          <p className="bmc-card-subtitle">
            Manage stage transitions, progression from Round 0 to Round 20, and event finalization
          </p>
        </div>
        <span className={`badge ${getStatusBadgeClass(config.status)}`}>
          <span className="badge-dot" />
          Status: {config.status}
        </span>
      </div>
      
      {error && (
        <div className="alert alert-error" role="alert">
          <span><strong>Action Error:</strong> {error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success" role="status">
          <span>{success}</span>
        </div>
      )}

      {/* Engine Metrics Grid */}
      <div className="bmc-stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Current Round</span>
          <div className="bmc-stat-value" style={{ color: 'var(--accent-electric)' }}>
            {config.currentRound} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {config.totalRounds}</span>
          </div>
          <span className="bmc-stat-meta">
            {config.currentRound === 0 ? 'Genesis Allocation' : `Round ${config.currentRound} Active`}
          </span>
        </div>

        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Lifecycle Stage</span>
          <div className="bmc-stat-value" style={{ fontSize: '1.35rem' }}>
            {config.status}
          </div>
          <span className="bmc-stat-meta">Authoritative state</span>
        </div>

        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Starting Capital</span>
          <div className="bmc-stat-value">
            ₹{config.startingCapital?.toLocaleString('en-IN')}
          </div>
          <span className="bmc-stat-meta">Per team allotment</span>
        </div>

        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Allocation Window</span>
          <div className="bmc-stat-value">
            {config.allocationWindowSeconds}s
          </div>
          <span className="bmc-stat-meta">Timer threshold</span>
        </div>
      </div>

      {/* Control Actions Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.25rem',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {config.status === 'SETUP' && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('start-allocation', 'Initial allocation phase started.')}
              className="btn btn-warning btn-lg"
            >
              ▶ Start Allocation Phase (Round 0)
            </button>
          )}

          {config.status === 'ALLOCATION' && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('start-round-1', 'Round 1 has started.')}
              className="btn btn-success btn-lg"
            >
              🚀 Launch Round 1 Trading
            </button>
          )}

          {config.status === 'RUNNING' && config.currentRound < config.totalRounds && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('advance-round', `Advanced to Round ${config.currentRound + 1}`)}
              className="btn btn-success btn-lg"
            >
              ⏩ Advance to Round {config.currentRound + 1}
            </button>
          )}

          {config.status === 'RUNNING' && config.currentRound === config.totalRounds && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('finish', 'Simulation has been marked as FINISHED.')}
              className="btn btn-primary btn-lg"
            >
              🏁 Conclude & Finish Simulation
            </button>
          )}

          {config.status === 'FINISHED' && (
            <div className="badge badge-finished" style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}>
              <span className="badge-dot" />
              Simulation Concluded & Locked
            </div>
          )}
        </div>

        {/* Danger Zone: Safeguarded Reset Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            type="button"
            disabled={loading}
            onClick={handleReset}
            className="btn btn-danger btn-sm"
            style={{ opacity: loading ? 0.5 : 1 }}
            title="Reset simulation lifecycle back to Round 0 SETUP"
          >
            ⚠️ Reset Lifecycle
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimulationControl;
