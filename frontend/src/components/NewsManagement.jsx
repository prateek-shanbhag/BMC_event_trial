import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function NewsManagement() {
  const { currentUser } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Form State
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [round, setRound] = useState(1);

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await currentUser.getIdToken();
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/news`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch news');
      }

      const data = await response.json();
      setNews(data.news || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [currentUser]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setRound(1);
    setError(null);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setRound(item.round);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || round < 1 || round > 20) {
      setError("Please provide a valid title, description, and round (1-20)");
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const url = editingId 
        ? `${import.meta.env.VITE_API_BASE_URL}/api/admin/news/${editingId}`
        : `${import.meta.env.VITE_API_BASE_URL}/api/admin/news`;
      
      const method = editingId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, description, round: Number(round) })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save news');
      }

      resetForm();
      fetchNews();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (newsId) => {
    if (!window.confirm("Are you sure you want to delete this news item?")) return;
    
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/news/${newsId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete news');
      
      fetchNews();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTogglePublish = async (newsId, currentStatus) => {
    try {
      const token = await currentUser.getIdToken();
      const action = currentStatus === 'PUBLISHED' ? 'unpublish' : 'publish';
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/news/${newsId}/${action}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error(`Failed to ${action} news`);
      
      fetchNews();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading && news.length === 0) {
    return (
      <div className="bmc-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading event news and market alerts...</span>
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
              📰
            </span>
            Market Intelligence & News Broadcasts
          </h3>
          <p className="bmc-card-subtitle">
            Draft, publish, and schedule round-specific economic releases for participants
          </p>
        </div>
        <span className="badge badge-setup">
          {news.length} Total News Bulletins
        </span>
      </div>
      
      {error && (
        <div className="alert alert-error" role="alert">
          <span><strong>News Error:</strong> {error}</span>
        </div>
      )}

      {/* Create / Edit Form Card */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.75rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {editingId ? 'Edit Event Announcement' : 'Compose New Market Bulletin'}
          </h4>
          {editingId && (
            <span className="badge badge-allocation">
              Editing Bulletin #{editingId}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px', gap: '1rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="news-title">
                Headline / Title
              </label>
              <input 
                id="news-title"
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder="e.g., Central Bank Holds Benchmark Repo Rate Steady"
                required
                className="form-input"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" htmlFor="news-round">
                Target Round (1-20)
              </label>
              <input 
                id="news-round"
                type="number" 
                value={round} 
                onChange={(e) => setRound(parseInt(e.target.value))} 
                min="1" 
                max="20"
                required
                className="form-input form-input-mono"
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="news-description">
              Announcement Body / Macro Impact Details
            </label>
            <textarea 
              id="news-description"
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Detail the market event and its anticipated impact on asset classes..."
              required
              rows={3}
              className="form-textarea"
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            {editingId && (
              <button 
                type="button" 
                onClick={resetForm} 
                className="btn btn-secondary"
              >
                Cancel
              </button>
            )}
            <button 
              type="submit" 
              className="btn btn-primary"
            >
              {editingId ? '💾 Save Changes' : '➕ Create Bulletin'}
            </button>
          </div>
        </form>
      </div>

      {/* News Items Listing */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Published & Draft Bulletins
        </h4>
      </div>

      {news.length === 0 ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No news bulletins created yet. Use the form above to compose the first release.
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>Round</th>
                <th style={{ width: '50%' }}>Headline & Summary</th>
                <th style={{ width: '15%' }}>Status</th>
                <th style={{ width: '25%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {news.map(item => {
                const isPublished = item.status === 'PUBLISHED';
                return (
                  <tr key={item.id}>
                    <td>
                      <span className="badge badge-setup" style={{ textTransform: 'none' }}>
                        Round {item.round}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {item.description}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${isPublished ? 'badge-running' : 'badge-allocation'}`}>
                        <span className="badge-dot" />
                        {item.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button 
                          type="button"
                          onClick={() => handleEdit(item)} 
                          className="btn btn-secondary btn-sm"
                        >
                          Edit
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleTogglePublish(item.id, item.status)}
                          className={`btn ${isPublished ? 'btn-warning' : 'btn-success'} btn-sm`}
                        >
                          {isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="btn btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default NewsManagement;
