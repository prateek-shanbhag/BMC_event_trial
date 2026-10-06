import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function AssetValueManagement() {
  const { currentUser } = useAuth();
  const [assetClasses, setAssetClasses] = useState([]);
  const [assetValues, setAssetValues] = useState({});
  const [selectedRound, setSelectedRound] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Local state for the inputs
  const [inputValues, setInputValues] = useState({});

  useEffect(() => {
    fetchAssetClasses();
  }, []);

  useEffect(() => {
    if (assetClasses.length > 0) {
      fetchAssetValuesForRound(selectedRound);
    }
  }, [selectedRound, assetClasses]);

  const fetchAssetClasses = async () => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/asset-classes`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch asset classes');
      }

      const data = await response.json();
      setAssetClasses(data.assetClasses);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchAssetValuesForRound = async (round) => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/asset-values/${round}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch asset values');
      }

      const data = await response.json();
      
      const valuesMap = {};
      const inputsMap = {};
      
      data.assetValues.forEach(av => {
        valuesMap[av.assetClassId] = av;
        inputsMap[av.assetClassId] = av.value;
      });
      
      setAssetValues(valuesMap);
      setInputValues(inputsMap);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (assetClassId) => {
    setError('');
    setSuccess('');
    
    const value = inputValues[assetClassId];
    if (value === undefined || value === '') {
      setError('Value cannot be empty');
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/asset-values/${selectedRound}/${assetClassId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: Number(value) })
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save asset value');
      }

      setSuccess(`Asset ${assetClassId} value saved successfully!`);
      // Update local state without fetching all again
      setAssetValues(prev => ({
        ...prev,
        [assetClassId]: { ...prev[assetClassId], value: Number(value) }
      }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (assetClassId) => {
    setError('');
    setSuccess('');
    
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/admin/asset-values/${selectedRound}/${assetClassId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete asset value');
      }

      setSuccess(`Asset ${assetClassId} value deleted successfully!`);
      
      // Update local state
      const newValuesMap = { ...assetValues };
      delete newValuesMap[assetClassId];
      setAssetValues(newValuesMap);
      
      const newInputsMap = { ...inputValues };
      newInputsMap[assetClassId] = '';
      setInputValues(newInputsMap);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInputChange = (assetClassId, value) => {
    setInputValues(prev => ({
      ...prev,
      [assetClassId]: value
    }));
  };

  const handleRoundChange = (e) => {
    setSelectedRound(Number(e.target.value));
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
      <h3>Asset Value Management</h3>
      
      {error && (
        <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>
          {success}
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <label htmlFor="roundSelect" style={{ fontWeight: 'bold', marginRight: '10px' }}>Round:</label>
        <select 
          id="roundSelect" 
          value={selectedRound} 
          onChange={handleRoundChange}
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          {Array.from({ length: 20 }, (_, i) => i + 1).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading asset values...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
              <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Asset Class</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Value</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Status</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {assetClasses.map(ac => {
              const isConfigured = !!assetValues[ac.id];
              return (
                <tr key={ac.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{ac.name}</td>
                  <td style={{ padding: '10px' }}>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0.01"
                      value={inputValues[ac.id] || ''} 
                      onChange={(e) => handleInputChange(ac.id, e.target.value)}
                      style={{ padding: '6px', width: '100px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </td>
                  <td style={{ padding: '10px' }}>
                    {isConfigured ? (
                      <span style={{ color: 'green', fontWeight: 'bold' }}>Configured</span>
                    ) : (
                      <span style={{ color: 'gray' }}>Not configured</span>
                    )}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button 
                      onClick={() => handleSave(ac.id)}
                      style={{ 
                        padding: '6px 12px', 
                        marginRight: '8px', 
                        backgroundColor: '#4CAF50', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer' 
                      }}
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => handleDelete(ac.id)}
                      disabled={!isConfigured}
                      style={{ 
                        padding: '6px 12px', 
                        backgroundColor: isConfigured ? '#f44336' : '#ccc', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: isConfigured ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AssetValueManagement;
