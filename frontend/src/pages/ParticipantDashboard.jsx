import { useAuth } from '../context/AuthContext';
import TeamView from '../components/TeamView';
import ParticipantAllocation from '../components/ParticipantAllocation';

function ParticipantDashboard() {
  const { currentUser, logout } = useAuth();

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
        <ParticipantAllocation />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>Portfolio</h3>
            <p style={{ color: '#666' }}>Placeholder: View your asset holdings and capital.</p>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>Current Round</h3>
            <p style={{ color: '#666' }}>Placeholder: Allocate your capital for the active round.</p>
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
