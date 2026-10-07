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
      <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', gridColumn: '1 / -1' }}>
        <h3>Simulation Control</h3>
        {error ? (
          <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'SETUP': return '#9e9e9e'; // Grey
      case 'ALLOCATION': return '#ff9800'; // Orange
      case 'RUNNING': return '#4caf50'; // Green
      case 'FINISHED': return '#2196f3'; // Blue
      default: return '#000';
    }
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', gridColumn: '1 / -1' }}>
      <h3 style={{ marginTop: 0 }}>Simulation Control</h3>
      
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      {success && <div style={{ color: 'green', marginBottom: '10px' }}>{success}</div>}

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', flex: 1, minWidth: '150px' }}>
          <strong>Status:</strong> <span style={{ color: getStatusColor(config.status), fontWeight: 'bold' }}>{config.status}</span>
        </div>
        <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', flex: 1, minWidth: '150px' }}>
          <strong>Current Round:</strong> <span style={{ fontSize: '1.1em', fontWeight: 'bold' }}>{config.currentRound}</span> / {config.totalRounds}
        </div>
        <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', flex: 1, minWidth: '150px' }}>
          <strong>Starting Capital:</strong> ₹{config.startingCapital?.toLocaleString('en-IN')}
        </div>
        <div style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', flex: 1, minWidth: '150px' }}>
          <strong>Allocation Window:</strong> {config.allocationWindowSeconds} sec
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        {config.status === 'SETUP' && (
          <button 
            disabled={loading}
            onClick={() => handleAction('start-allocation', 'Initial allocation phase started.')}
            style={buttonStyle('#ff9800')}
          >
            Start Allocation
          </button>
        )}

        {config.status === 'ALLOCATION' && (
          <button 
            disabled={loading}
            onClick={() => handleAction('start-round-1', 'Round 1 has started.')}
            style={buttonStyle('#4caf50')}
          >
            Start Round 1
          </button>
        )}

        {config.status === 'RUNNING' && config.currentRound < config.totalRounds && (
          <button 
            disabled={loading}
            onClick={() => handleAction('advance-round', `Advanced to Round ${config.currentRound + 1}`)}
            style={buttonStyle('#4caf50')}
          >
            Advance to Next Round
          </button>
        )}

        {config.status === 'RUNNING' && config.currentRound === config.totalRounds && (
          <button 
            disabled={loading}
            onClick={() => handleAction('finish', 'Simulation has been marked as FINISHED.')}
            style={buttonStyle('#2196f3')}
          >
            Finish Simulation
          </button>
        )}

        {config.status === 'FINISHED' && (
          <div style={{ padding: '8px 16px', backgroundColor: '#e3f2fd', color: '#1976d2', borderRadius: '4px', fontWeight: 'bold' }}>
            Simulation Finished
          </div>
        )}

        <div style={{ flexGrow: 1 }} />
        
        <button 
          disabled={loading}
          onClick={handleReset}
          style={{ ...buttonStyle('#f44336'), opacity: loading ? 0.5 : 1 }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

const buttonStyle = (bgColor) => ({
  padding: '10px 16px',
  backgroundColor: bgColor,
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold'
});

export default SimulationControl;
