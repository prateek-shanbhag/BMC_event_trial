import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

function Leaderboard({ isAdmin }) {
  const { currentUser } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [isFinished, setIsFinished] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setError('');
      setIsFinished(true);
      const token = await currentUser.getIdToken();
      const endpoint = isAdmin ? '/api/admin/leaderboard' : '/api/participant/leaderboard';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 409) {
        setIsFinished(false);
        setLeaderboard([]);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error('Leaderboard request failed:', err);
      setError('Unable to load tournament standings. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, isAdmin]);

  useEffect(() => {
    if (currentUser) {
      fetchLeaderboard();
    }
  }, [currentUser, fetchLeaderboard]);

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: '#ffffff',
          fontWeight: 700,
          boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)'
        }}>
          1
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
          color: '#ffffff',
          fontWeight: 700
        }}>
          2
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #b45309 0%, #78350f 100%)',
          color: '#ffffff',
          fontWeight: 700
        }}>
          3
        </span>
      );
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-muted)',
        fontWeight: 600,
        fontFamily: 'var(--font-mono)'
      }}>
        {rank}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bmc-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading tournament leaderboard standings...</span>
        </div>
      </div>
    );
  }

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
              🏆
            </span>
            Official Standings & Leaderboard
          </h3>
          <p className="bmc-card-subtitle">
            Ranked by final portfolio valuation at the conclusion of Round 20
          </p>
        </div>
        <button 
          type="button"
          onClick={fetchLeaderboard}
          className="btn btn-secondary btn-sm"
          aria-label="Refresh tournament standings"
        >
          🔄 Refresh Standings
        </button>
      </div>

      {error ? (
        <div className="alert alert-error" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span><strong>Notice:</strong> {error}</span>
          <button 
            type="button"
            onClick={fetchLeaderboard}
            className="btn btn-secondary btn-sm"
          >
            Retry
          </button>
        </div>
      ) : !isFinished ? (
        <div className="alert alert-info" style={{ margin: 0 }}>
          <span>
            <strong>Standings Pending:</strong> Standings will be available after the simulation finishes.
          </span>
        </div>
      ) : leaderboard.length === 0 ? (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No final leaderboard data recorded yet. Standings will populate upon simulation completion.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '8%', textAlign: 'center' }}>Rank</th>
                <th style={{ width: '28%' }}>Team Squad</th>
                <th style={{ textAlign: 'right' }}>Total Portfolio Value</th>
                <th style={{ textAlign: 'right' }}>Invested Capital</th>
                <th style={{ textAlign: 'right' }}>Cash Reserve</th>
                <th style={{ textAlign: 'right' }}>Net P/L</th>
                <th style={{ textAlign: 'right' }}>Return %</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => {
                const isGain = (entry.profitLoss || 0) >= 0;
                const isReturnGain = (entry.returnPercentage || 0) >= 0;
                return (
                  <tr key={entry.teamId} style={{
                    background: entry.rank === 1 ? 'rgba(245, 158, 11, 0.05)' : undefined
                  }}>
                    <td style={{ textAlign: 'center' }}>
                      {getRankBadge(entry.rank)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {entry.teamName}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {entry.teamId}
                      </div>
                    </td>
                    <td className="col-mono" style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.95rem' }}>
                      ₹{entry.totalPortfolioValue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="col-mono" style={{ textAlign: 'right' }}>
                      ₹{entry.investedValue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="col-mono" style={{ textAlign: 'right' }}>
                      ₹{entry.cash?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge ${isGain ? 'badge-gain' : 'badge-loss'}`}>
                        {isGain ? '+' : ''}₹{entry.profitLoss?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge ${isReturnGain ? 'badge-gain' : 'badge-loss'}`}>
                        {isReturnGain ? '+' : ''}{entry.returnPercentage?.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
