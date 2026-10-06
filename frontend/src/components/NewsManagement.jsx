import React, { useState, useEffect } from 'react';
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

  if (loading && news.length === 0) return <div>Loading News Management...</div>;

  return (
    <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
      <h3>News Management</h3>
      
      {error && <div style={{ color: 'white', backgroundColor: '#f44336', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}

      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
        <h4 style={{ marginTop: 0 }}>{editingId ? 'Edit News' : 'Create News'}</h4>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              required
              rows="3"
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Round (1-20)</label>
            <input 
              type="number" 
              value={round} 
              onChange={(e) => setRound(parseInt(e.target.value))} 
              min="1" 
              max="20"
              required
              style={{ padding: '8px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {editingId ? 'Save Changes' : 'Create'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} style={{ padding: '8px 16px', backgroundColor: '#888', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <h4 style={{ marginTop: 0 }}>All News</h4>
      {news.length === 0 ? (
        <p>No news items found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#eee' }}>
              <th style={{ padding: '10px', borderBottom: '2px solid #ccc' }}>Round</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #ccc' }}>Title</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #ccc' }}>Status</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #ccc' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {news.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{item.round}</td>
                <td style={{ padding: '10px' }}>
                  <div style={{ fontWeight: 'bold' }}>{item.title}</div>
                  <div style={{ fontSize: '0.85em', color: '#666' }}>{item.description}</div>
                </td>
                <td style={{ padding: '10px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    fontSize: '0.85em', 
                    fontWeight: 'bold',
                    backgroundColor: item.status === 'PUBLISHED' ? '#e6f4ea' : '#fff3e0',
                    color: item.status === 'PUBLISHED' ? '#1e8e3e' : '#e65100'
                  }}>
                    {item.status}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => handleEdit(item)} style={{ padding: '4px 8px', fontSize: '0.85em', cursor: 'pointer' }}>Edit</button>
                    <button 
                      onClick={() => handleTogglePublish(item.id, item.status)}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '0.85em', 
                        cursor: 'pointer',
                        backgroundColor: item.status === 'PUBLISHED' ? '#ff9800' : '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      {item.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      style={{ padding: '4px 8px', fontSize: '0.85em', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '4px' }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default NewsManagement;
