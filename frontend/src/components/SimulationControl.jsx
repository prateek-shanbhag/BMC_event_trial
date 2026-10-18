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
    if (window.confirm("Are you sure you want to completely RESET the simulation lifecycle back to SETUP? This does NOT delete teams, users, or news, but resets the simulation state machine to Round 0 SETUP.")) {
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
      case 'INITIAL_ALLOCATION_OPEN':
      case 'ALLOCATION': return 'badge-allocation';
      case 'ROUND_PREPARATION':
      case 'NEWS_PUBLISHED': return 'badge-setup';
      case 'REALLOCATION_OPEN': return 'badge-running';
      case 'REALLOCATION_CLOSED': return 'badge-setup';
      case 'RESULTS_PUBLISHED': return 'badge-success';
      case 'FINISHED': return 'badge-finished';
      default: return 'badge-setup';
    }
  };

  const getExplanation = () => {
    switch (config.status) {
      case 'SETUP':
        return 'Simulation is in initial setup. Click Start Initial Allocation to allow participants to allocate their ₹10,00,000 starting capital.';
      case 'INITIAL_ALLOCATION_OPEN':
      case 'ALLOCATION':
        return 'Initial allocation is OPEN for Round 0. Participants can allocate starting capital. Click Initialize Portfolios to establish starting portfolios and advance to Round 1 Preparation.';
      case 'ROUND_PREPARATION':
      case 'NEWS_PUBLISHED':
        return `Round ${config.currentRound} preparation. Verify all 7 asset values and ensure at least one draft news item exists, then click Publish News & Open Reallocation.`;
      case 'REALLOCATION_OPEN':
        return `Round ${config.currentRound} portfolio reallocation is OPEN. Participants are rebalancing. Click Close Reallocation when time is up.`;
      case 'REALLOCATION_CLOSED':
        return `Round ${config.currentRound} reallocation is CLOSED. Click Evaluate & Publish Results to settle portfolios against current asset values.`;
      case 'RESULTS_PUBLISHED':
        if (config.currentRound < config.totalRounds) {
          return `Round ${config.currentRound} results are published. Snapshots are recorded. Click Prepare Next Round to advance to Round ${config.currentRound + 1}.`;
        }
        return 'Round 20 results are published. Click Finish Simulation to conclude the tournament and unlock the official leaderboard.';
      case 'FINISHED':
        return 'The simulation is officially concluded. All 20 rounds have been settled. The tournament leaderboard is now live for all participants and administrators.';
      default:
        return 'Authoritative state managed by backend engine.';
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
            Manage strict stage transitions, atomic news-and-reallocation release, portfolio settlement, and tournament conclusion
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
          <div className="bmc-stat-value" style={{ fontSize: '1.15rem' }}>
            {config.status}
          </div>
          <span className="bmc-stat-meta">Backend authoritative</span>
        </div>

        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Starting Capital</span>
          <div className="bmc-stat-value">
            ₹{config.startingCapital?.toLocaleString('en-IN')}
          </div>
          <span className="bmc-stat-meta">Per team baseline</span>
        </div>

        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Reallocation Mode</span>
          <div className="bmc-stat-value" style={{ fontSize: '1.1rem', color: config.status === 'REALLOCATION_OPEN' ? 'var(--gain-light)' : 'var(--text-muted)' }}>
            {config.status === 'REALLOCATION_OPEN' ? 'OPEN' : config.status === 'INITIAL_ALLOCATION_OPEN' ? 'INITIAL OPEN' : 'LOCKED'}
          </div>
          <span className="bmc-stat-meta">Participant trading status</span>
        </div>
      </div>

      {/* Human-Readable Explanation Banner */}
      <div style={{
        padding: '0.85rem 1.15rem',
        background: 'rgba(30, 41, 59, 0.6)',
        borderLeft: '4px solid var(--accent-electric)',
        borderRadius: '8px',
        marginBottom: '1.25rem',
        fontSize: '0.875rem',
        color: 'var(--text-secondary)'
      }}>
        <strong style={{ color: 'var(--text-primary)', marginRight: '0.5rem' }}>Current Phase:</strong>
        {getExplanation()}
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
          
          {/* Action 1: SETUP -> Start Initial Allocation */}
          {config.status === 'SETUP' && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('start-initial-allocation', 'Initial allocation phase opened for Round 0.')}
              className="btn btn-warning btn-lg"
            >
              ▶ Start Initial Allocation
            </button>
          )}

          {/* Action 2: INITIAL_ALLOCATION_OPEN -> Initialize Portfolios */}
          {(config.status === 'INITIAL_ALLOCATION_OPEN' || config.status === 'ALLOCATION') && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('initialize-portfolios', 'Portfolios initialized. Round 1 begins in ROUND_PREPARATION.')}
              className="btn btn-success btn-lg"
            >
              🚀 Initialize Portfolios & Begin Round 1
            </button>
          )}

          {/* Action 3: ROUND_PREPARATION -> Publish News & Open Reallocation */}
          {(config.status === 'ROUND_PREPARATION' || config.status === 'NEWS_PUBLISHED') && config.currentRound >= 1 && config.currentRound <= config.totalRounds && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('publish-news-and-open-reallocation', `Round ${config.currentRound} news published and reallocation opened.`)}
              className="btn btn-primary btn-lg"
            >
              📢 Publish Round {config.currentRound} News & Open Reallocation
            </button>
          )}

          {/* Action 4: REALLOCATION_OPEN -> Close Reallocation */}
          {config.status === 'REALLOCATION_OPEN' && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('close-reallocation', `Round ${config.currentRound} reallocation closed.`)}
              className="btn btn-warning btn-lg"
            >
              🔒 Close Reallocation
            </button>
          )}

          {/* Action 5: REALLOCATION_CLOSED -> Evaluate & Publish Results */}
          {config.status === 'REALLOCATION_CLOSED' && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('evaluate-round', `Round ${config.currentRound} evaluated and results published.`)}
              className="btn btn-success btn-lg"
            >
              📊 Evaluate & Publish Results
            </button>
          )}

          {/* Action 6: RESULTS_PUBLISHED (Rounds 1–19) -> Start Next Round */}
          {config.status === 'RESULTS_PUBLISHED' && config.currentRound < config.totalRounds && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('start-next-round', `Round ${config.currentRound + 1} preparation started.`)}
              className="btn btn-primary btn-lg"
            >
              ⏩ Prepare Round {config.currentRound + 1}
            </button>
          )}

          {/* Action 7: RESULTS_PUBLISHED (Round 20) -> Finish Simulation */}
          {config.status === 'RESULTS_PUBLISHED' && config.currentRound === config.totalRounds && (
            <button 
              type="button"
              disabled={loading}
              onClick={() => handleAction('finish', 'Simulation officially finished! Leaderboard unlocked.')}
              className="btn btn-finish btn-lg"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: 700
              }}
            >
              🏁 Conclude Contest & Release Leaderboard
            </button>
          )}

          {/* Final State Banner */}
          {config.status === 'FINISHED' && (
            <span style={{ color: 'var(--success-emerald)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🏆</span> Simulation Completed. Final Standings Live on Leaderboard.
            </span>
          )}
        </div>

        {/* Safe Dev / Admin Reset */}
        <button 
          type="button"
          disabled={loading}
          onClick={handleReset}
          className="btn btn-danger btn-sm"
          title="Reset simulation status to Round 0 SETUP"
        >
          🔄 Reset to SETUP
        </button>
      </div>
    </div>
  );
}

export default SimulationControl;
