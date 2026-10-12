import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function AdminPortfolioManagement() {
  const { currentUser } = useAuth();
  
  const [simulationState, setSimulationState] = useState(null);
  const [teams, setTeams] = useState([]);
  const [portfolios, setPortfolios] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Selection
  const [selectedTeamId, setSelectedTeamId] = useState('');
  
  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  
  // Valuation State
  const [selectedRound, setSelectedRound] = useState(1);
  const [valuation, setValuation] = useState(null);
  const [valuationLoading, setValuationLoading] = useState(false);
  const [valuationError, setValuationError] = useState('');

  const fetchData = async () => {
    try {
      const token = await currentUser.getIdToken();
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [simRes, teamsRes, portRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/simulation/state`, { headers }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/teams`, { headers }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/portfolios`, { headers })
      ]);
      
      if (simRes.ok) setSimulationState(await simRes.json());
      if (teamsRes.ok) {
        const tData = await teamsRes.json();
        setTeams(tData.teams || []);
      }
      if (portRes.ok) {
        const pData = await portRes.json();
        setPortfolios(pData.portfolios || []);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser]);

  const fetchTeamHistory = async (teamId) => {
    setHistory([]);
    setHistoryError('');
    setHistoryLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/portfolios/${teamId}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch history');
      setHistory(data.history || []);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTeamId) {
      setValuation(null);
      setValuationError('');
      fetchTeamHistory(selectedTeamId);
    }
  }, [selectedTeamId]);

  const handleInitialize = async () => {
    setLoading(true);
    setMessage('');
    setError('');
    
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/portfolios/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize portfolios');
      }
      
      setMessage(`Initialized: ${data.initialized?.length || 0}. Already Initialized: ${data.alreadyInitialized?.length || 0}. Skipped: ${data.skipped?.length || 0}.`);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateValuation = async () => {
    if (!selectedTeamId) return;
    if (selectedRound === 0) {
      setValuationError('Round 0 is the initial allocation round.');
      return;
    }
    
    setValuationLoading(true);
    setValuationError('');
    setValuation(null);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/portfolios/${selectedTeamId}/valuation/${selectedRound}`, {
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

  const getAssetName = (key) => {
    switch (key) {
      case '1': return 'Asset Class 1';
      case '2': return 'Asset Class 2';
      case '3': return 'Asset Class 3';
      case '4': return 'Government Securities';
      case '5': return 'Bank Fixed Deposits';
      case '6': return 'Real Estate';
      case '7': return 'Gold';
      default: return `Asset Class ${key}`;
    }
  };

  const getTeamName = (teamId) => {
    const t = teams.find(t => t.id === teamId);
    return t ? t.name : teamId;
  };

  const selectedPortfolio = portfolios.find(p => p.teamId === selectedTeamId);

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
              📊
            </span>
            Portfolio & Simulation Monitoring
          </h3>
          <p className="bmc-card-subtitle">
            Inspect team holdings, trigger batch initialization, and evaluate round performance
          </p>
        </div>
        <button 
          type="button"
          onClick={handleInitialize} 
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Initializing Portfolios...' : '⚡ Initialize Portfolios'}
        </button>
      </div>
      
      {error && (
        <div className="alert alert-error" role="alert">
          <span><strong>Monitoring Error:</strong> {error}</span>
        </div>
      )}
      {message && (
        <div className="alert alert-success" role="status">
          <span>{message}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="bmc-stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Total Teams</span>
          <div className="bmc-stat-value">{teams.length}</div>
          <span className="bmc-stat-meta">Registered squads</span>
        </div>
        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Active Portfolios</span>
          <div className="bmc-stat-value" style={{ color: 'var(--accent-electric)' }}>
            {portfolios.length}
          </div>
          <span className="bmc-stat-meta">Initialized portfolios</span>
        </div>
        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Simulation Round</span>
          <div className="bmc-stat-value">
            {simulationState?.currentRound ?? '-'} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ 20</span>
          </div>
          <span className="bmc-stat-meta">Stage: {simulationState?.status ?? '-'}</span>
        </div>
        <div className="bmc-stat-card">
          <span className="bmc-stat-label">Selected Squad</span>
          <div className="bmc-stat-value" style={{ fontSize: '1.15rem', color: selectedTeamId ? 'var(--gain-light)' : 'var(--text-muted)' }}>
            {selectedTeamId ? getTeamName(selectedTeamId) : 'None'}
          </div>
          <span className="bmc-stat-meta">Click a team row to inspect</span>
        </div>
      </div>

      {/* Team Portfolios Table */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            All Team Portfolios
          </h4>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Tip: Click any row to view deep holdings & valuation
          </span>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Team Squad</th>
                <th style={{ textAlign: 'right' }}>Cash Reserve</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Current Round</th>
              </tr>
            </thead>
            <tbody>
              {portfolios.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No team portfolios initialized yet. Click &quot;Initialize Portfolios&quot; above to initialize.
                  </td>
                </tr>
              ) : (
                portfolios.map(p => {
                  const isSelected = selectedTeamId === p.teamId;
                  return (
                    <tr 
                      key={p.id} 
                      onClick={() => setSelectedTeamId(p.teamId)}
                      style={{ 
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(56, 189, 248, 0.12)' : undefined,
                        borderLeft: isSelected ? '3px solid var(--accent-electric)' : undefined
                      }}
                    >
                      <td style={{ fontWeight: 600, color: isSelected ? 'var(--accent-electric)' : 'var(--text-primary)' }}>
                        {p.teamName || getTeamName(p.teamId)}
                      </td>
                      <td className="col-mono" style={{ textAlign: 'right' }}>
                        ₹{p.cash?.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className="badge badge-setup">
                          {p.status}
                        </span>
                      </td>
                      <td className="col-mono" style={{ textAlign: 'right' }}>
                        {p.currentRound}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep-Dive Inspection Panel for Selected Team */}
      {selectedTeamId && (
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-default)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <span className="bmc-stat-label">Squad Profile</span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.25rem', color: 'var(--accent-electric)' }}>
                {getTeamName(selectedTeamId)}
              </h3>
            </div>
            <span className="badge badge-running">
              Inspecting Team ID: {selectedTeamId}
            </span>
          </div>
          
          {selectedPortfolio ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* Holdings Breakdown */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '1.25rem'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Current Holdings Allocation
                </h4>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Asset Class</th>
                        <th style={{ textAlign: 'right' }}>Held Quantity (Units)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPortfolio.holdings && Object.entries(selectedPortfolio.holdings).map(([key, value]) => (
                        <tr key={key}>
                          <td style={{ fontWeight: 600 }}>{getAssetName(key)}</td>
                          <td className="col-mono" style={{ textAlign: 'right', color: 'var(--accent-electric)' }}>
                            {value?.toLocaleString('en-IN') || 0} units
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  background: 'rgba(6, 9, 19, 0.5)',
                  borderRadius: '8px',
                  marginTop: '1rem',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}>
                  <div>
                    <span className="bmc-stat-label">Total Invested</span>
                    <div className="col-mono" style={{ fontSize: '1.15rem' }}>
                      ₹{selectedPortfolio.totalInvested?.toLocaleString('en-IN') || 0}
                    </div>
                  </div>
                  <div>
                    <span className="bmc-stat-label">Liquid Cash</span>
                    <div className="col-mono" style={{ fontSize: '1.15rem', color: 'var(--gain-light)' }}>
                      ₹{selectedPortfolio.cash?.toLocaleString('en-IN') || 0}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Temporary Valuation Tool for Admin */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '1.25rem'
              }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Valuation Model Inspector
                </h4>
                <div className="valuation-disclaimer" role="note" style={{ marginBottom: '1rem' }}>
                  <span>TEMPORARY DEVELOPMENT VALUATION MODEL — replace when official financial rules are finalized.</span>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label htmlFor="admin-valuation-round" className="form-label" style={{ margin: 0 }}>
                      Round:
                    </label>
                    <select 
                      id="admin-valuation-round"
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
                    {valuationLoading ? 'Computing...' : 'Calculate Valuation'}
                  </button>
                </div>

                {valuationError && (
                  <div className="alert alert-error" role="alert">
                    <span>{valuationError}</span>
                  </div>
                )}

                {valuation && (
                  <div style={{
                    background: 'rgba(6, 9, 19, 0.5)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    marginTop: '1rem'
                  }}>
                    <h5 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>
                      Valuation Outcome (Round {valuation.round})
                    </h5>
                    <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Asset Class</th>
                            <th style={{ textAlign: 'right' }}>Holding Units</th>
                            <th style={{ textAlign: 'right' }}>Round Multiplier</th>
                            <th style={{ textAlign: 'right' }}>Calculated Value (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(valuation.assets).map(key => (
                            <tr key={key}>
                              <td style={{ fontWeight: 600 }}>{getAssetName(key)}</td>
                              <td className="col-mono" style={{ textAlign: 'right' }}>
                                {valuation.assets[key].holding?.toLocaleString('en-IN')}
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
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '1rem',
                      padding: '1rem',
                      background: 'rgba(15, 23, 42, 0.7)',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <span className="bmc-stat-label">Liquid Cash</span>
                        <div className="col-mono" style={{ fontSize: '1.15rem' }}>
                          ₹{valuation.cash?.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div>
                        <span className="bmc-stat-label">Total Invested</span>
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
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
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

              {/* Historical Snapshots Table */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '1.25rem'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Round-by-Round Snapshots History
                </h4>

                {historyError && (
                  <div className="alert alert-error">
                    <span>{historyError}</span>
                  </div>
                )}
                {historyLoading ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading historical snapshots...</div>
                ) : history.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No completed round snapshots for this team.</div>
                ) : (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Round</th>
                          <th style={{ textAlign: 'right' }}>Invested Value (₹)</th>
                          <th style={{ textAlign: 'right' }}>Cash (₹)</th>
                          <th style={{ textAlign: 'right' }}>Total Value (₹)</th>
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
                              <td>
                                <span className="badge badge-setup">
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
                              <td style={{ textAlign: 'right' }}>
                                {isRoundZero ? '—' : (
                                  <span className={`badge ${isGain ? 'badge-gain' : 'badge-loss'}`}>
                                    {isGain ? '+' : ''}₹{snap.profitLoss?.toLocaleString('en-IN') || '0'}
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'right' }}>
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
                )}
              </div>
            </div>
          ) : (
            <div className="alert alert-warning">
              <span>This squad does not have an active portfolio initialized yet. Click &quot;Initialize Portfolios&quot; above to initialize all teams.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminPortfolioManagement;
