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

      setTeams(teamsData.teams || []);
      setParticipants(partsData.participants || []);
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

  if (loading && teams.length === 0) {
    return (
      <div className="bmc-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading teams and participant assignments...</span>
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
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--accent-electric)',
              fontSize: '0.85rem'
            }}>
              👥
            </span>
            Team Rosters & Participant Allocation
          </h3>
          <p className="bmc-card-subtitle">
            Create trading squads and assign participants before the simulation starts
          </p>
        </div>
        <span className="badge badge-setup">
          {teams.length} Teams Registered
        </span>
      </div>
      
      {error && (
        <div className="alert alert-error" role="alert">
          <span><strong>Team Management Error:</strong> {error}</span>
        </div>
      )}

      {/* Create Team Form Card */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
          Register New Squad
        </h4>
        <form onSubmit={handleCreateTeam} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            value={newTeamName} 
            onChange={(e) => setNewTeamName(e.target.value)} 
            placeholder="Enter Team Name (e.g., Alpha Capital, Apex Traders)"
            className="form-input"
            style={{ flexGrow: 1, minWidth: '220px' }}
            required
            aria-label="New team name"
          />
          <button type="submit" className="btn btn-primary">
            ➕ Register Squad
          </button>
        </form>
      </div>

      {/* Teams Grid / List */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Active Squad Rosters
        </h4>
      </div>

      {teams.length === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No squads registered yet. Create your first team above.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {teams.map(team => (
            <div 
              key={team.id} 
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 150ms ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    {team.name}
                  </div>
                  <span className="badge badge-setup" style={{ textTransform: 'none' }}>
                    {team.members?.length || 0} Member{team.members?.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Member Chips */}
                <div style={{ marginBottom: '1.25rem' }}>
                  {team.members && team.members.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {team.members.map(member => (
                        <div 
                          key={member.uid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.35rem 0.65rem',
                            background: 'rgba(6, 9, 19, 0.45)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '6px',
                            fontSize: '0.8rem'
                          }}
                        >
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {member.name || member.email}
                          </span>
                          <button 
                            type="button"
                            onClick={() => handleRemoveParticipant(team.id, member.uid)}
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--loss-light)', padding: '0.15rem 0.45rem', fontSize: '0.75rem' }}
                            title="Remove member from squad"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      No participants assigned yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Selector */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-subtle)'
              }}>
                <select 
                  id={`assign-${team.id}`}
                  defaultValue="" 
                  className="form-select"
                  style={{ flexGrow: 1, padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                  aria-label={`Select participant to assign to ${team.name}`}
                >
                  <option value="" disabled>Select participant...</option>
                  {participants.filter(p => p.teamId !== team.id).map(p => (
                    <option key={p.uid} value={p.uid}>
                      {p.name || p.email} {p.teamId ? '(Transfer)' : '(Unassigned)'}
                    </option>
                  ))}
                </select>
                <button 
                  type="button"
                  onClick={() => {
                    const select = document.getElementById(`assign-${team.id}`);
                    handleAssignParticipant(team.id, select.value);
                    select.value = "";
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  Assign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TeamManagement;
