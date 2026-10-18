import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

function ParticipantNews({ simulationState }) {
  const { currentUser } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNews = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setError(null);
      const token = await currentUser.getIdToken();

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/news`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      setNews(data.news || []);
    } catch (err) {
      console.error('Participant news request failed:', err);
      setError('Unable to load market wire bulletins. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchNews();
    }
  }, [currentUser, fetchNews, simulationState?.currentRound]);

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
              📡
            </span>
            Market Wire & Event Intel
          </h3>
          <p className="bmc-card-subtitle">Real-time macro announcements and round bulletins</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={fetchNews}
            className="btn btn-secondary btn-sm"
            aria-label="Refresh market wire"
            disabled={loading}
          >
            🔄 Refresh Wire
          </button>
          <span className="badge badge-running">
            <span className="badge-dot" />
            Live Wire
          </span>
        </div>
      </div>

      {loading && news.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1.25rem',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '10px'
        }}>
          <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Fetching latest round bulletins...</span>
        </div>
      ) : error ? (
        <div className="alert alert-error" style={{ margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span><strong>Notice:</strong> {error}</span>
          <button 
            type="button"
            onClick={fetchNews}
            className="btn btn-secondary btn-sm"
          >
            Retry
          </button>
        </div>
      ) : news.length === 0 ? (
        <div style={{
          padding: '2rem 1.25rem',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px dashed var(--border-subtle)',
          borderRadius: '10px',
          color: 'var(--text-muted)',
          fontSize: '0.875rem'
        }}>
          <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>📭</div>
          No news has been published for this round yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {news.map((item) => (
            <div 
              key={item.id}
              style={{
                padding: '1.25rem',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid var(--border-subtle)',
                borderLeft: '4px solid var(--accent-electric)',
                borderRadius: '10px',
                transition: 'border-color var(--transition-fast)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span className="badge badge-setup" style={{ fontSize: '0.725rem' }}>
                  Round {item.round} Bulletin
                </span>
                {item.createdAt && (
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <h4 style={{ 
                margin: '0 0 0.5rem 0', 
                fontSize: '1.05rem', 
                color: 'var(--text-primary)',
                fontWeight: 600,
                lineHeight: 1.4
              }}>
                {item.title}
              </h4>

              <p style={{ 
                margin: 0, 
                color: 'var(--text-secondary)', 
                fontSize: '0.875rem', 
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap'
              }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ParticipantNews;
