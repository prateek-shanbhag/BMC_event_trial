import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function TeamManagement() {
  const { currentUser } = useAuth();
  const [teams, setTeams] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTeamsAndParticipants = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await currentUser.getIdToken();
      
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const [teamsRes, partsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/teams`, { headers }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/participants`, { headers })
      ]);

      if (!teamsRes.ok || !partsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const teamsData = await teamsRes.json();
      const partsData = await partsRes.json();

      setTeams(teamsData.teams);
      setParticipants(partsData.participants);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamsAndParticipants();
  }, [currentUser]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newTeamName })
      });

      if (!response.ok) throw new Error('Failed to create team');
      
      setNewTeamName('');
      fetchTeamsAndParticipants();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAssignParticipant = async (teamId, uid) => {
    if (!uid) return;
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/teams/${teamId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign participant');
      }
      
      fetchTeamsAndParticipants();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveParticipant = async (teamId, uid) => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/teams/${teamId}/members/${uid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to remove participant');
      
      fetchTeamsAndParticipants();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div>Loading Team Management...</div>;

  return (
    <div style={{ marginTop: '20px' }}>
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
      
      <div style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
        <h3>Create New Team</h3>
        <form onSubmit={handleCreateTeam} style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={newTeamName} 
            onChange={(e) => setNewTeamName(e.target.value)} 
            placeholder="Team Name"
            style={{ padding: '8px', flexGrow: 1 }}
          />
          <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Create</button>
        </form>
      </div>

      <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
        <h3>Teams List</h3>
        {teams.length === 0 ? <p>No teams created yet.</p> : null}
        
        {teams.map(team => (
          <div key={team.id} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #eee', borderRadius: '4px' }}>
            <h4 style={{ margin: '0 0 10px 0' }}>{team.name} <span style={{ fontSize: '0.8em', color: '#666' }}>({team.members?.length || 0} members)</span></h4>
            
            <div style={{ marginBottom: '10px' }}>
              {team.members && team.members.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {team.members.map(member => (
                    <li key={member.uid} style={{ marginBottom: '5px' }}>
                      {member.name || member.email} 
                      <button 
                        onClick={() => handleRemoveParticipant(team.id, member.uid)}
                        style={{ marginLeft: '10px', padding: '2px 8px', fontSize: '0.8em', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: '#888', fontStyle: 'italic' }}>No members</p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select 
                id={`assign-${team.id}`}
                defaultValue="" 
                style={{ padding: '6px' }}
              >
                <option value="" disabled>Select participant...</option>
                {participants.filter(p => p.teamId !== team.id).map(p => (
                  <option key={p.uid} value={p.uid}>{p.name || p.email} {p.teamId ? '(Change Team)' : '(No Team)'}</option>
                ))}
              </select>
              <button 
                onClick={() => {
                  const select = document.getElementById(`assign-${team.id}`);
                  handleAssignParticipant(team.id, select.value);
                  select.value = "";
                }}
                style={{ padding: '6px 12px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Assign
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TeamManagement;
