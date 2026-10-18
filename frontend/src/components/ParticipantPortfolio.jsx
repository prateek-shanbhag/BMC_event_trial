import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function ParticipantPortfolio({ simulationState }) {
  const { currentUser } = useAuth();
  const [portfolio, setPortfolio] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Valuation state
  const [selectedRound, setSelectedRound] = useState(1);
  const [valuation, setValuation] = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState('');

  // History state
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const token = await currentUser.getIdToken();
        const [portfolioRes, teamRes, historyRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/portfolio`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/team`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/portfolio/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);

        const data = await portfolioRes.json();
        
        if (!portfolioRes.ok) {
          throw new Error(data.error || 'Failed to fetch portfolio');
        }

        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (teamData.team) {
            setTeamName(teamData.team.name);
          }
        }

        if (historyRes.ok) {
          const historyData = await historyRes.json();
          setHistory(historyData.history || []);
        } else {
          setHistoryError('Failed to load portfolio history.');
        }

        setPortfolio(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, [currentUser]);

  const calculateValuation = async () => {
    if (!selectedRound) return;
    setValuationLoading(true);
    setValuationError('');
    setValuation(null);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/portfolio/valuation/${selectedRound}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response (Status: ${response.status}). ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Failed to calculate valuation (Status: ${response.status})`);
      setValuation(data);
    } catch (err) {
      setValuationError(err.message);
    } finally {
      setValuationLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bmc-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading live portfolio metrics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span><strong>Portfolio Error:</strong> {error}</span>
      </div>
    );
  }

  if (!portfolio) return null;

  const getAssetName = (key) => {
    switch (key) {
      case 'assetClass1':
      case '1': return 'Asset Class 1';
      case 'assetClass2':
      case '2': return 'Asset Class 2';
      case 'assetClass3':
      case '3': return 'Asset Class 3';
      case 'governmentSecurities':
      case '4': return 'Government Securities';
      case 'bankFixedDeposits':
      case '5': return 'Bank Fixed Deposits';
      case 'realEstate':
      case '6': return 'Real Estate';
      case 'gold':
      case '7': return 'Gold';
      default: return key;
    }
  };

  const totalCapitalBase = (portfolio.totalInvested || 0) + (portfolio.cash || 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Portfolio Overview & KPI Card */}
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
                💼
              </span>
              Active Portfolio
            </h3>
            <p className="bmc-card-subtitle">
              Holdings, cash reserve, and allocation distribution for {teamName || portfolio.teamId}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-running">
              <span className="badge-dot" />
              {portfolio.status || 'ACTIVE'}
            </span>
            <span className="badge badge-setup">
              Round {simulationState ? simulationState.currentRound : portfolio.currentRound}
            </span>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="bmc-stat-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="bmc-stat-card">
            <span className="bmc-stat-label">Total Capital Base</span>
            <div className="bmc-stat-value">₹{totalCapitalBase.toLocaleString('en-IN')}</div>
            <span className="bmc-stat-meta">Portfolio book capital</span>
          </div>
          <div className="bmc-stat-card">
            <span className="bmc-stat-label">Total Invested</span>
            <div className="bmc-stat-value" style={{ color: 'var(--accent-electric)' }}>
              ₹{portfolio.totalInvested?.toLocaleString('en-IN') || 0}
            </div>
            <span className="bmc-stat-meta">
              {totalCapitalBase > 0 ? `${((portfolio.totalInvested / totalCapitalBase) * 100).toFixed(1)}% deployed` : '0%'}
            </span>
          </div>
          <div className="bmc-stat-card">
            <span className="bmc-stat-label">Cash Reserve</span>
            <div className="bmc-stat-value" style={{ color: 'var(--gain-light)' }}>
              ₹{portfolio.cash?.toLocaleString('en-IN') || 0}
            </div>
            <span className="bmc-stat-meta">
              {totalCapitalBase > 0 ? `${((portfolio.cash / totalCapitalBase) * 100).toFixed(1)}% liquid cash` : '100%'}
            </span>
          </div>
          <div className="bmc-stat-card">
            <span className="bmc-stat-label">Holdings Count</span>
            <div className="bmc-stat-value">
              {portfolio.holdings ? Object.values(portfolio.holdings).filter(v => v > 0).length : 0}
            </div>
            <span className="bmc-stat-meta">Active asset classes</span>
          </div>
        </div>

        {/* Asset Holdings Breakdown */}
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Asset Holdings Breakdown
          </h4>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset Class</th>
                  <th style={{ textAlign: 'right' }}>Units / Value (₹)</th>
                  <th style={{ width: '30%' }}>Allocation Weight</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings && Object.entries(portfolio.holdings).map(([key, value]) => {
                  const numVal = Number(value) || 0;
                  const weight = totalCapitalBase > 0 ? ((numVal / totalCapitalBase) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={key}>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {getAssetName(key)}
                      </td>
                      <td className="col-mono" style={{ textAlign: 'right' }}>
                        ₹{numVal.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="progress-track" style={{ margin: 0, height: '6px' }}>
                            <div 
                              className="progress-bar progress-bar-electric" 
                              style={{ width: `${Math.min(100, Number(weight))}%` }}
                            />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', minWidth: '38px', textAlign: 'right' }}>
                            {weight}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0.75rem 0 0 0' }}>
          Note: This is your current portfolio state. Allocations can only be modified during specific rounds.
        </p>
      </div>

      {/* Round-by-Round History Section */}
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
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-indigo)',
                fontSize: '0.85rem'
              }}>
                📈
              </span>
              Round Performance History
            </h3>
            <p className="bmc-card-subtitle">
              Snapshots of portfolio valuation and returns computed across completed rounds
            </p>
          </div>
        </div>

        {historyError && (
          <div className="alert alert-error">
            <span>{historyError}</span>
          </div>
        )}

        {history.length === 0 && !historyError ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No completed round snapshots yet. Historical performance will appear after the first round transitions.
          </div>
        ) : history.length > 0 ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th style={{ textAlign: 'right' }}>Invested Value (₹)</th>
                  <th style={{ textAlign: 'right' }}>Cash (₹)</th>
                  <th style={{ textAlign: 'right' }}>Total Portfolio Value (₹)</th>
                  <th style={{ textAlign: 'right' }}>P/L (₹)</th>
                  <th style={{ textAlign: 'right' }}>Return %</th>
                </tr>
              </thead>
              <tbody>
                {history.map(snap => {
                  const isRoundZero = snap.round === 0;
                  const isGain = (snap.profitLoss || 0) >= 0;
                  const isReturnGain = (snap.returnPercentage || 0) >= 0;
                  return (
                    <tr key={snap.round}>
                      <td style={{ fontWeight: 600 }}>
                        <span className="badge badge-setup" style={{ textTransform: 'none' }}>
                          Round {snap.round}
                        </span>
                      </td>
                      <td className="col-mono" style={{ textAlign: 'right' }}>
                        {isRoundZero ? '—' : `₹${snap.investedValue?.toLocaleString('en-IN') || '0'}`}
                      </td>
                      <td className="col-mono" style={{ textAlign: 'right' }}>
                        ₹{snap.cash?.toLocaleString('en-IN') || '0'}
                      </td>
                      <td className="col-mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {isRoundZero ? '—' : `₹${snap.totalPortfolioValue?.toLocaleString('en-IN') || '0'}`}
                      </td>
                      <td style={{ textAlign: 'right' }} className={isRoundZero ? '' : (isGain ? 'col-gain' : 'col-loss')}>
                        {isRoundZero ? '—' : (
                          <span className={`badge ${isGain ? 'badge-gain' : 'badge-loss'}`}>
                            {isGain ? '+' : ''}₹{snap.profitLoss?.toLocaleString('en-IN') || '0'}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} className={isRoundZero ? '' : (isReturnGain ? 'col-gain' : 'col-loss')}>
                        {isRoundZero ? '—' : (
                          <span className={`badge ${isReturnGain ? 'badge-gain' : 'badge-loss'}`}>
                            {isReturnGain ? '+' : ''}{snap.returnPercentage?.toFixed(2)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Temporary Valuation Model Section */}
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
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--gain-light)',
                fontSize: '0.85rem'
              }}>
                🧮
              </span>
              On-Demand Valuation Calculator
            </h3>
            <p className="bmc-card-subtitle">
              Simulate portfolio value against historical or target round asset pricing
            </p>
          </div>
        </div>

        {/* Required Prototype Valuation Disclaimer */}
        <div className="valuation-disclaimer" role="note">
          <span style={{ fontWeight: 700 }}>NOTICE:</span>
          <span>TEMPORARY DEVELOPMENT VALUATION MODEL — replace when official financial rules are finalized.</span>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label htmlFor="participant-round-select" className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>
              Select Round:
            </label>
            <select 
              id="participant-round-select"
              value={selectedRound} 
              onChange={(e) => setSelectedRound(parseInt(e.target.value))} 
              className="form-select"
              style={{ width: '130px', padding: '0.45rem 0.65rem' }}
            >
              {[...Array(20)].map((_, i) => (
                <option key={i+1} value={i+1}>Round {i+1}</option>
              ))}
            </select>
          </div>
          
          <button 
            type="button"
            onClick={calculateValuation} 
            disabled={valuationLoading}
            className="btn btn-primary"
          >
            {valuationLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge-dot" style={{ background: '#fff', animation: 'pulse-dot 1s infinite' }} />
                Calculating...
              </span>
            ) : (
              'Calculate Valuation'
            )}
          </button>
        </div>

        {valuationError && (
          <div className="alert alert-error" role="alert">
            <span><strong>Valuation Error:</strong> {valuationError}</span>
          </div>
        )}

        {valuation && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            padding: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
                Valuation Results (Round {valuation.round})
              </h4>
              <span className="badge badge-setup">
                Round {valuation.round} Price Basis
              </span>
            </div>

            <div className="table-wrapper" style={{ marginBottom: '1.25rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asset Class</th>
                    <th style={{ textAlign: 'right' }}>Holding (₹)</th>
                    <th style={{ textAlign: 'right' }}>Asset Multiplier</th>
                    <th style={{ textAlign: 'right' }}>Calculated Value (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(valuation.assets).map(key => (
                    <tr key={key}>
                      <td style={{ fontWeight: 600 }}>{getAssetName(key)}</td>
                      <td className="col-mono" style={{ textAlign: 'right' }}>
                        ₹{valuation.assets[key].holding?.toLocaleString('en-IN')}
                      </td>
                      <td className="col-mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                        {valuation.assets[key].assetValue}
                      </td>
                      <td className="col-mono" style={{ textAlign: 'right', color: 'var(--accent-electric)' }}>
                        ₹{valuation.assets[key].calculatedValue?.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Summary Metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              padding: '1rem',
              background: 'rgba(6, 9, 19, 0.5)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div>
                <span className="bmc-stat-label">Liquid Cash</span>
                <div className="col-mono" style={{ fontSize: '1.15rem' }}>
                  ₹{valuation.cash?.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <span className="bmc-stat-label">Invested Assets</span>
                <div className="col-mono" style={{ fontSize: '1.15rem' }}>
                  ₹{valuation.totalInvestedValue?.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <span className="bmc-stat-label">Total Portfolio Value</span>
                <div className="col-mono" style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--accent-electric)' }}>
                  ₹{valuation.totalPortfolioValue?.toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <span className="bmc-stat-label">Temporary P/L & Return</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span className={`badge ${valuation.profitLoss >= 0 ? 'badge-gain' : 'badge-loss'}`}>
                    {valuation.profitLoss >= 0 ? '+' : ''}₹{valuation.profitLoss?.toLocaleString('en-IN')}
                  </span>
                  <span className={`badge ${valuation.percentageReturn >= 0 ? 'badge-gain' : 'badge-loss'}`}>
                    {valuation.percentageReturn >= 0 ? '+' : ''}{valuation.percentageReturn?.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ParticipantPortfolio;
