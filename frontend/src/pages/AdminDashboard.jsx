import { useAuth } from '../context/AuthContext';
import TeamManagement from '../components/TeamManagement';
import NewsManagement from '../components/NewsManagement';
import AssetValueManagement from '../components/AssetValueManagement';

function AdminDashboard() {
  const { currentUser, logout } = useAuth();

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>BMC Investment Simulator</h1>
      <h2>Admin Dashboard</h2>
      <p>Welcome, {currentUser?.email}</p>
      <p style={{ fontWeight: 'bold', color: '#0070f3' }}>Role: ADMIN</p>
      
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
        <TeamManagement />
        <NewsManagement />
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>Simulation Control</h3>
            <p style={{ color: '#666' }}>Placeholder: Start, stop, or pause the simulation.</p>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>Rounds</h3>
            <p style={{ color: '#666' }}>Placeholder: Manage 20 rounds of the competition.</p>
          </div>
          <AssetValueManagement />
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>Leaderboard</h3>
            <p style={{ color: '#666' }}>Placeholder: Live ranking of teams.</p>
          </div>
          <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
            <h3>Results</h3>
            <p style={{ color: '#666' }}>Placeholder: Final evaluation and scoring.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
