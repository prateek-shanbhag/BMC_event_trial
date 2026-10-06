import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function TeamView() {
  const { currentUser } = useAuth();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTeamInfo = async () => {
      try {
        setLoading(true);
        const token = await currentUser.getIdToken();
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/team`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 404) {
          setTeam(null);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch team info');
        }

        const data = await response.json();
        setTeam(data.team);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTeamInfo();
  }, [currentUser]);

  if (loading) return <div>Loading Team Info...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
      <h3>My Team</h3>
      {team ? (
        <div>
          <h4 style={{ margin: '0 0 10px 0', color: '#0070f3' }}>{team.name}</h4>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Members:</p>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            {team.members && team.members.map(member => (
              <li key={member.uid}>
                {member.name || member.email} 
                {member.uid === currentUser.uid && ' (You)'}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ color: '#f5a623', margin: 0 }}>You are not assigned to a team yet. Please wait for an administrator to assign you.</p>
      )}
    </div>
  );
}

export default TeamView;
