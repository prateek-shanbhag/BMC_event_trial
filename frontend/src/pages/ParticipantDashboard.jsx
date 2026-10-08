import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import TeamView from '../components/TeamView';
import ParticipantAllocation from '../components/ParticipantAllocation';
import ParticipantPortfolio from '../components/ParticipantPortfolio';

function ParticipantDashboard() {
  const { currentUser, logout } = useAuth();
  const [simulationState, setSimulationState] = useState(null);
  const [loading, setLoading] = useState(true);

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
        }
      } catch (error) {
        console.error('Error fetching simulation state:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSimulationState();
  }, [currentUser]);

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>BMC Investment Simulator</h1>
      <h2>Participant Dashboard</h2>
      <p>Welcome, {currentUser?.email}</p>
      <p style={{ fontWeight: 'bold', color: '#0070f3' }}>Role: PARTICIPANT</p>
      
      <button 
        onClick={logout} 
        style={{ 
          padding: '8px 16px', 
          cursor: 'pointer',
          backgroundColor: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontWeight: 'bold',
          marginBottom: '20px'
        }}>
        Logout
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
        <TeamView />
        <ParticipantAllocation simulationState={simulationState} />
        
        <ParticipantPortfolio simulationState={simulationState} />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>Current Round</h3>
            {loading ? (
              <p style={{ color: '#666' }}>Loading simulation state...</p>
            ) : simulationState?.status === 'FINISHED' ? (
              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.2em', color: '#1976d2' }}>
                  Simulation Finished
                </p>
                <p style={{ color: '#666' }}>
                  The simulation has concluded.
                </p>
              </div>
            ) : (
              <div>
                <p style={{ fontWeight: 'bold', fontSize: '1.2em', color: simulationState?.status === 'RUNNING' ? '#2e7d32' : '#f57c00' }}>
                  {simulationState?.currentRound === 0 ? 'Round 0 (Initial Allocation)' : `Round ${simulationState?.currentRound}`}
                </p>
                <p style={{ color: '#666' }}>
                  Status: {simulationState?.status}
                </p>
              </div>
            )}
          </div>
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>News</h3>
            <p style={{ color: '#666' }}>Placeholder: Real-time news affecting asset prices.</p>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>Leaderboard</h3>
            <p style={{ color: '#666' }}>Placeholder: See where your team stands.</p>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>Results</h3>
            <p style={{ color: '#666' }}>Placeholder: View final portfolio valuation and ranking.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParticipantDashboard;
