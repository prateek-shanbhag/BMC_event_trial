import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import TeamView from '../components/TeamView';
import ParticipantAllocation from '../components/ParticipantAllocation';
import ParticipantPortfolio from '../components/ParticipantPortfolio';
import Leaderboard from '../components/Leaderboard';
import ParticipantNews from '../components/ParticipantNews';

function ParticipantDashboard() {
  const { currentUser, logout } = useAuth();
  const [simulationState, setSimulationState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('portfolio');

  const fetchSimulationState = async () => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/simulation-state`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSimulationState(data);
        // If allocation or reallocation is open, default to allocation tab on initial load
        if ((data.currentRound === 0 && (data.status === 'INITIAL_ALLOCATION_OPEN' || data.status === 'ALLOCATION')) || data.status === 'REALLOCATION_OPEN') {
          // keep existing tab if user already selected, otherwise default
        }
      }
    } catch (error) {
      console.error('Error fetching simulation state:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulationState();
  }, [currentUser]);

  const isReallocationOpen = simulationState?.currentRound === 0
    ? (simulationState?.status === 'INITIAL_ALLOCATION_OPEN' || simulationState?.status === 'ALLOCATION')
    : (simulationState?.status === 'REALLOCATION_OPEN');

  const getStatusBadge = () => {
    if (loading) {
      return (
        <span className="badge badge-setup">
          <span className="badge-dot" />
          Connecting...
        </span>
      );
    }
    const status = simulationState?.status;
    const round = simulationState?.currentRound ?? 0;

    switch (status) {
      case 'SETUP':
        return (
          <span className="badge badge-setup">
            <span className="badge-dot" />
            Round 0: Setup
          </span>
        );
      case 'INITIAL_ALLOCATION_OPEN':
      case 'ALLOCATION':
        return (
          <span className="badge badge-allocation">
            <span className="badge-dot" />
            Round 0: Allocation Open
          </span>
        );
      case 'ROUND_PREPARATION':
      case 'NEWS_PUBLISHED':
        return (
          <span className="badge badge-setup">
            <span className="badge-dot" />
            Round {round}: Preparing Round
          </span>
        );
      case 'REALLOCATION_OPEN':
        return (
          <span className="badge badge-running">
            <span className="badge-dot" />
            Round {round}: Reallocation Open
          </span>
        );
      case 'REALLOCATION_CLOSED':
      case 'EVALUATING':
        return (
          <span className="badge badge-allocation">
            <span className="badge-dot" />
            Round {round}: Evaluating
          </span>
        );
      case 'RESULTS_PUBLISHED':
        return (
          <span className="badge badge-finished" style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--gain-light)' }}>
            <span className="badge-dot" style={{ background: 'var(--gain-light)' }} />
            Round {round}: Results Published
          </span>
        );
      case 'FINISHED':
        return (
          <span className="badge badge-finished">
            <span className="badge-dot" />
            Simulation Concluded
          </span>
        );
      default:
        return (
          <span className="badge badge-setup">
            <span className="badge-dot" />
            {status || 'Connecting'}
          </span>
        );
    }
  };

  const currentRoundNum = simulationState?.currentRound || 0;
  const totalRounds = simulationState?.totalRounds || 20;
  const roundProgress = simulationState?.status === 'FINISHED' 
    ? 100 
    : Math.min(100, Math.max(0, (currentRoundNum / totalRounds) * 100));

  return (
    <div className="bmc-shell animate-fade-in">
      {/* Top Header Navigation */}
      <header className="bmc-topbar">
        <div className="bmc-brand">
          <div className="bmc-logo-mark">BMC</div>
          <div className="bmc-brand-text">
            <h1>BMC Investment Simulator</h1>
            <span className="bmc-brand-sub">Participant Trading Desk</span>
          </div>
        </div>

        <div className="bmc-topbar-actions">
          {getStatusBadge()}

          <div className="bmc-user-pill">
            <span style={{ color: 'var(--text-secondary)' }}>{currentUser?.email}</span>
            <span className="role-badge">PARTICIPANT</span>
          </div>

          <button 
            type="button"
            onClick={logout} 
            className="btn btn-danger btn-sm"
            aria-label="Logout from trading terminal"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Simulation Status Hero Card */}
      <div className="bmc-card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(20, 30, 55, 0.7) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <span className="bmc-stat-label">Event Round Status</span>
            <h2 style={{ fontSize: '1.5rem', margin: '0.2rem 0 0.35rem 0', color: 'var(--text-primary)' }}>
              {loading ? (
                'Loading simulation status...'
              ) : simulationState?.status === 'FINISHED' ? (
                'Simulation Concluded — Final Standings Live'
              ) : simulationState?.currentRound === 0 ? (
                'Round 0: Initial Portfolio Allocation'
              ) : (
                `Active Tournament: Round ${simulationState?.currentRound} of ${totalRounds}`
              )}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              {simulationState?.status === 'FINISHED' 
                ? 'All rounds completed. Official final results and leaderboard are published below.'
                : simulationState?.status === 'REALLOCATION_OPEN'
                ? `Round ${currentRoundNum} Reallocation is OPEN. Rebalance your portfolio holdings across assets and cash.`
                : simulationState?.status === 'INITIAL_ALLOCATION_OPEN' || simulationState?.status === 'ALLOCATION'
                ? 'Deploy starting capital of ₹10,00,000 across the 7 available asset classes.'
                : simulationState?.status === 'RESULTS_PUBLISHED'
                ? `Round ${currentRoundNum} results published. Check your updated portfolio valuation and historical snapshots.`
                : 'Round values and historical snapshots are updated in real-time as the simulation advances.'}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className="bmc-stat-label">Round Progression</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-electric)' }}>
              {currentRoundNum} <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>/ {totalRounds}</span>
            </div>
          </div>
        </div>

        {/* Round Progress Visualizer */}
        <div>
          <div className="progress-track" style={{ height: '7px' }}>
            <div 
              className="progress-bar progress-bar-electric"
              style={{ width: `${roundProgress}%` }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            <span>Round 0 (Genesis)</span>
            <span>Round 10 (Mid-Point)</span>
            <span>Round 20 (Final)</span>
          </div>
        </div>
      </div>

      {/* Navigation Segmented Tabs */}
      <nav className="bmc-tab-nav" aria-label="Participant dashboard tabs">
        <button 
          type="button"
          onClick={() => setActiveTab('portfolio')} 
          className={`bmc-tab-btn ${activeTab === 'portfolio' ? 'active' : ''}`}
        >
          💼 Portfolio & Valuation
        </button>

        <button 
          type="button"
          onClick={() => setActiveTab('allocation')} 
          className={`bmc-tab-btn ${activeTab === 'allocation' ? 'active' : ''}`}
        >
          ⚖️ {currentRoundNum === 0 ? 'Initial Allocation' : `Reallocation (Round ${currentRoundNum})`}
          {isReallocationOpen && (
            <span className="badge-dot" style={{ background: 'var(--accent-electric)' }} />
          )}
        </button>

        <button 
          type="button"
          onClick={() => setActiveTab('news')} 
          className={`bmc-tab-btn ${activeTab === 'news' ? 'active' : ''}`}
        >
          📰 Event Broadcast
        </button>

        <button 
          type="button"
          onClick={() => setActiveTab('leaderboard')} 
          className={`bmc-tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
        >
          🏆 Tournament Standings
        </button>
      </nav>

      {/* Responsive Layout Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '1.5rem'
      }}>
        {/* Dynamic Main View */}
        {activeTab === 'portfolio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* If reallocation is open, display reallocation workbench prominently */}
            {isReallocationOpen && (
              <ParticipantAllocation simulationState={simulationState} />
            )}
            
            <ParticipantPortfolio simulationState={simulationState} />

            {/* Event News & Broadcast Panel */}
            <ParticipantNews simulationState={simulationState} />
          </div>
        )}

        {activeTab === 'allocation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <ParticipantAllocation simulationState={simulationState} />
          </div>
        )}

        {activeTab === 'news' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <ParticipantNews simulationState={simulationState} />
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard isAdmin={false} />
        )}

        {/* Team Squad Overview */}
        <TeamView />
      </div>
    </div>
  );
}

export default ParticipantDashboard;
