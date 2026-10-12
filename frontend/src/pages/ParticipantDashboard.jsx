import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import TeamView from '../components/TeamView';
import ParticipantAllocation from '../components/ParticipantAllocation';
import ParticipantPortfolio from '../components/ParticipantPortfolio';
import Leaderboard from '../components/Leaderboard';

function ParticipantDashboard() {
  const { currentUser, logout } = useAuth();
  const [simulationState, setSimulationState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('portfolio');

  useEffect(() => {
    const fetchSimulationState = async () => {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/simulation-state`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setSimulationState(data);
          // If Round 0 and ALLOCATION, auto-focus allocation tab
          if (data.currentRound === 0 && data.status === 'ALLOCATION') {
            setActiveTab('allocation');
          }
        }
      } catch (error) {
        console.error('Error fetching simulation state:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSimulationState();
  }, [currentUser]);

  const isAllocationRound = simulationState?.currentRound === 0 && simulationState?.status === 'ALLOCATION';

  const getStatusBadge = () => {
    if (loading) {
      return (
        <span className="badge badge-setup">
          <span className="badge-dot" />
          Connecting...
        </span>
      );
    }
    if (simulationState?.status === 'FINISHED') {
      return (
        <span className="badge badge-finished">
          <span className="badge-dot" />
          Finished
        </span>
      );
    }
    if (simulationState?.status === 'RUNNING') {
      return (
        <span className="badge badge-running">
          <span className="badge-dot" />
          Live Round {simulationState?.currentRound} / {simulationState?.totalRounds || 20}
        </span>
      );
    }
    if (simulationState?.status === 'ALLOCATION') {
      return (
        <span className="badge badge-allocation">
          <span className="badge-dot" />
          Round 0: Allocation Open
        </span>
      );
    }
    return (
      <span className="badge badge-setup">
        <span className="badge-dot" />
        {simulationState?.status || 'Setup'}
      </span>
    );
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
                'Simulation Concluded'
              ) : simulationState?.currentRound === 0 ? (
                'Round 0: Initial Portfolio Allocation'
              ) : (
                `Active Trading: Round ${simulationState?.currentRound} of ${totalRounds}`
              )}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              {simulationState?.status === 'FINISHED' 
                ? 'All rounds completed. Official final results are published below.'
                : simulationState?.status === 'ALLOCATION'
                ? 'Set up your starting capital allocation across the 7 available asset classes.'
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

        {isAllocationRound && (
          <button 
            type="button"
            onClick={() => setActiveTab('allocation')} 
            className={`bmc-tab-btn ${activeTab === 'allocation' ? 'active' : ''}`}
          >
            ⚖️ Initial Allocation
            <span className="badge-dot" style={{ background: 'var(--warning-amber)' }} />
          </button>
        )}

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
            {/* Show allocation workbench if in allocation round even within portfolio tab */}
            {isAllocationRound && (
              <ParticipantAllocation simulationState={simulationState} />
            )}
            
            <ParticipantPortfolio simulationState={simulationState} />

            {/* Event News & Broadcast Panel */}
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
                      📡
                    </span>
                    Market Wire & Event Intel
                  </h3>
                  <p className="bmc-card-subtitle">Real-time macro announcements and round bulletins</p>
                </div>
                <span className="badge badge-running">
                  <span className="badge-dot" />
                  Live Wire
                </span>
              </div>
              <div style={{
                padding: '1.25rem',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                lineHeight: 1.6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-electric)', fontWeight: 600, marginBottom: '0.35rem' }}>
                  <span>📢 Official Event Broadcast</span>
                </div>
                Market conditions and asset value multipliers fluctuate dynamically based on macroeconomic releases each round.
                Monitor your portfolio valuations closely across rounds to track asset class growth trajectories.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'allocation' && (
          <ParticipantAllocation simulationState={simulationState} />
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
