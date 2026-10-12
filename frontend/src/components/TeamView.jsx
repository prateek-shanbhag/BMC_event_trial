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

  if (loading) {
    return (
      <div className="bmc-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading team profile...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span><strong>Team Error:</strong> {error}</span>
      </div>
    );
  }

  return (
    <div className="bmc-card">
      <div className="bmc-card-header" style={{ marginBottom: '1rem' }}>
        <div>
          <div className="bmc-card-title">
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
            Team Assignment
          </div>
          <p className="bmc-card-subtitle">Your registered trading group for this event</p>
        </div>
        {team && (
          <span className="badge badge-running" style={{ textTransform: 'none', letterSpacing: 'normal' }}>
            <span className="badge-dot" />
            Active Team
          </span>
        )}
      </div>

      {team ? (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            marginBottom: '1rem'
          }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                Squad Identifier
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {team.name}
              </div>
            </div>
            <div style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '0.35rem 0.75rem',
              borderRadius: '9999px'
            }}>
              {team.members?.length || 0} Member{team.members?.length === 1 ? '' : 's'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
              Roster
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {team.members && team.members.map(member => {
                const isCurrent = member.uid === currentUser.uid;
                return (
                  <div 
                    key={member.uid} 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      background: isCurrent ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                      border: isCurrent ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid var(--border-subtle)',
                      fontSize: '0.825rem',
                      color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)'
                    }}
                  >
                    <span style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: isCurrent ? 'var(--accent-electric)' : 'var(--text-muted)'
                    }} />
                    <span>{member.name || member.email}</span>
                    {isCurrent && (
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        color: 'var(--accent-electric)',
                        background: 'rgba(56, 189, 248, 0.2)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px'
                      }}>
                        YOU
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-warning" style={{ margin: 0 }}>
          <span>
            <strong>Unassigned:</strong> You are not assigned to a team yet. Please wait for an event administrator to assign you before participating in allocations.
          </span>
        </div>
      )}
    </div>
  );
}

export default TeamView;
