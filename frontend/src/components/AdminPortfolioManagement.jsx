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
    <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
      <h3>Portfolio & Simulation Monitoring</h3>
      
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      {message && <div style={{ color: 'green', marginBottom: '10px' }}>{message}</div>}

      <div style={{ marginBottom: '20px', padding: '15px', background: '#eef', borderRadius: '4px' }}>
        <h4>Simulation Status</h4>
        <p><strong>Current Round:</strong> {simulationState?.currentRound ?? '-'}</p>
        <p><strong>Status:</strong> {simulationState?.status ?? '-'}</p>
        <p><strong>Total Rounds:</strong> 20</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={handleInitialize} 
          disabled={loading}
          style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '15px' }}
        >
          {loading ? 'Initializing...' : 'Initialize Portfolios'}
        </button>
        
        <h4>Team Portfolios</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '8px' }}>Team</th>
              <th style={{ padding: '8px' }}>Cash</th>
              <th style={{ padding: '8px' }}>Status</th>
              <th style={{ padding: '8px' }}>Current Round</th>
            </tr>
          </thead>
          <tbody>
            {portfolios.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '8px', textAlign: 'center' }}>No portfolios initialized yet.</td>
              </tr>
            ) : (
              portfolios.map(p => (
                <tr 
                  key={p.id} 
                  style={{ borderBottom: '1px solid #ddd', cursor: 'pointer', background: selectedTeamId === p.teamId ? '#f0f8ff' : 'transparent' }}
                  onClick={() => setSelectedTeamId(p.teamId)}
                >
                  <td style={{ padding: '8px' }}>{p.teamName || getTeamName(p.teamId)}</td>
                  <td style={{ padding: '8px' }}>₹{p.cash?.toLocaleString('en-IN')}</td>
                  <td style={{ padding: '8px' }}>{p.status}</td>
                  <td style={{ padding: '8px' }}>{p.currentRound}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedTeamId && (
        <div style={{ padding: '20px', borderTop: '2px solid #ddd' }}>
          <h3>Team: {getTeamName(selectedTeamId)}</h3>
          
          {selectedPortfolio ? (
            <>
              <div style={{ marginBottom: '30px' }}>
                <h4>Current Portfolio</h4>
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                  {selectedPortfolio.holdings && Object.entries(selectedPortfolio.holdings).map(([key, value]) => (
                    <li key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                      <span>{getAssetName(key)}</span>
                      <span>{value?.toLocaleString('en-IN') || 0} units</span>
                    </li>
                  ))}
                </ul>
                <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '4px', marginTop: '10px' }}>
                  <p style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                    <strong>Total Invested:</strong>
                    <span>₹{selectedPortfolio.totalInvested?.toLocaleString('en-IN') || 0}</span>
                  </p>
                  <p style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                    <strong>Cash:</strong>
                    <span>₹{selectedPortfolio.cash?.toLocaleString('en-IN') || 0}</span>
                  </p>
                </div>
              </div>
              
              <div style={{ marginBottom: '30px' }}>
                <h4>Temporary Valuation Model</h4>
                <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
                  <div>
                    <label>Round: </label>
                    <select value={selectedRound} onChange={(e) => setSelectedRound(parseInt(e.target.value))} style={{ padding: '4px' }}>
                      {[...Array(20)].map((_, i) => (
                        <option key={i+1} value={i+1}>Round {i+1}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={calculateValuation} 
                    disabled={valuationLoading}
                    style={{ padding: '6px 12px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: valuationLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {valuationLoading ? 'Calculating...' : 'Calculate Valuation'}
                  </button>
                </div>

                {valuationError && <div style={{ color: 'red', marginBottom: '15px' }}>{valuationError}</div>}

                {valuation && (
                  <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
                    <h5>Valuation Results (Round {valuation.round})</h5>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #ccc' }}>
                          <th style={{ padding: '8px' }}>Asset</th>
                          <th style={{ padding: '8px' }}>Holding</th>
                          <th style={{ padding: '8px' }}>Current Value</th>
                          <th style={{ padding: '8px' }}>Calculated Value (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(valuation.assets).map(key => (
                          <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px' }}>{getAssetName(key)}</td>
                            <td style={{ padding: '8px' }}>{valuation.assets[key].holding?.toLocaleString('en-IN')} units</td>
                            <td style={{ padding: '8px' }}>{valuation.assets[key].assetValue}</td>
                            <td style={{ padding: '8px' }}>{valuation.assets[key].calculatedValue?.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <p><strong>Cash:</strong> ₹{valuation.cash?.toLocaleString('en-IN')}</p>
                    <p><strong>Total Invested Value:</strong> ₹{valuation.totalInvestedValue?.toLocaleString('en-IN')}</p>
                    <p style={{ fontSize: '18px' }}><strong>Total Portfolio Value:</strong> ₹{valuation.totalPortfolioValue?.toLocaleString('en-IN')}</p>
                    <hr style={{ margin: '15px 0' }} />
                    <p style={{ color: valuation.profitLoss >= 0 ? 'green' : 'red' }}>
                      <strong>Temporary P/L:</strong> ₹{valuation.profitLoss?.toLocaleString('en-IN')}
                    </p>
                    <p style={{ color: valuation.percentageReturn >= 0 ? 'green' : 'red' }}>
                      <strong>Temporary Return:</strong> {valuation.percentageReturn?.toFixed(2)}%
                    </p>
                  </div>
                )}
              </div>

              <div>
                <h4>Round History</h4>
                {historyError && <div style={{ color: 'red' }}>{historyError}</div>}
                {historyLoading ? (
                  <p>Loading history...</p>
                ) : history.length === 0 ? (
                  <p>No completed rounds.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ccc' }}>
                        <th style={{ padding: '8px' }}>Round</th>
                        <th style={{ padding: '8px' }}>Invested Value (₹)</th>
                        <th style={{ padding: '8px' }}>Cash (₹)</th>
                        <th style={{ padding: '8px' }}>Total Value (₹)</th>
                        <th style={{ padding: '8px' }}>P/L (₹)</th>
                        <th style={{ padding: '8px' }}>Return %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(snap => (
                        <tr key={snap.round} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px' }}>{snap.round}</td>
                          <td style={{ padding: '8px' }}>
                            {snap.round === 0 ? '—' : snap.investedValue?.toLocaleString('en-IN') || '0'}
                          </td>
                          <td style={{ padding: '8px' }}>{snap.cash?.toLocaleString('en-IN') || '0'}</td>
                          <td style={{ padding: '8px' }}>
                            {snap.round === 0 ? '—' : snap.totalPortfolioValue?.toLocaleString('en-IN') || '0'}
                          </td>
                          <td style={{ padding: '8px', color: snap.round === 0 ? 'inherit' : (snap.profitLoss >= 0 ? 'green' : 'red') }}>
                            {snap.round === 0 ? '—' : snap.profitLoss?.toLocaleString('en-IN') || '0'}
                          </td>
                          <td style={{ padding: '8px', color: snap.round === 0 ? 'inherit' : (snap.returnPercentage >= 0 ? 'green' : 'red') }}>
                            {snap.round === 0 ? '—' : `${snap.returnPercentage?.toFixed(2)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <p>Portfolio not initialized</p>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminPortfolioManagement;
