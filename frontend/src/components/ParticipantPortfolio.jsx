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

  if (loading) return <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>Loading Portfolio...</div>;
  if (error) return <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', color: 'red' }}>Portfolio: {error}</div>;
  if (!portfolio) return null;

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

  return (
    <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
      <h3>Portfolio</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Team:</strong> {teamName || portfolio.teamId}</p>
        <p><strong>Portfolio Status:</strong> {portfolio.status}</p>
        <p><strong>Current Simulation Round:</strong> {simulationState ? simulationState.currentRound : portfolio.currentRound}</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h4>Holdings</h4>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {portfolio.holdings && Object.entries(portfolio.holdings).map(([key, value]) => (
            <li key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
              <span>{getAssetName(key)}</span>
              <span>₹{value?.toLocaleString('en-IN') || 0}</span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ background: '#f9f9f9', padding: '15px', borderRadius: '4px' }}>
        <p style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
          <strong>Total Invested:</strong>
          <span>₹{portfolio.totalInvested?.toLocaleString('en-IN') || 0}</span>
        </p>
        <p style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
          <strong>Cash:</strong>
          <span>₹{portfolio.cash?.toLocaleString('en-IN') || 0}</span>
        </p>
      </div>
      
      <p style={{ color: '#666', fontSize: '12px', marginTop: '20px' }}>
        Note: This is your current portfolio state. Allocations can only be modified during specific rounds.
      </p>

      <div style={{ marginTop: '40px', padding: '20px', borderTop: '2px solid #ddd' }}>
        <h3>Round History</h3>
        {historyError && <div style={{ color: 'red' }}>{historyError}</div>}
        {history.length === 0 && !historyError && <p>No completed rounds found.</p>}
        {history.length > 0 && (
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

      <div style={{ marginTop: '40px', padding: '20px', borderTop: '2px solid #ddd' }}>
        <h3>Temporary Valuation Model</h3>
        <p style={{ color: '#d9534f', fontWeight: 'bold', fontSize: '14px' }}>TEMPORARY DEVELOPMENT VALUATION MODEL — replace when official financial rules are finalized.</p>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'center' }}>
          <div>
            <label>Select Round: </label>
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
            <h4>Valuation Results (Round {valuation.round})</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc' }}>
                  <th style={{ padding: '8px' }}>Asset</th>
                  <th style={{ padding: '8px' }}>Holding (₹)</th>
                  <th style={{ padding: '8px' }}>Current Value</th>
                  <th style={{ padding: '8px' }}>Calculated Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(valuation.assets).map(key => (
                  <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{getAssetName(key)}</td>
                    <td style={{ padding: '8px' }}>{valuation.assets[key].holding?.toLocaleString('en-IN')}</td>
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
    </div>
  );
}

export default ParticipantPortfolio;
