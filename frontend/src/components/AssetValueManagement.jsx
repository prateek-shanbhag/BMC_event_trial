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

      setSuccess(`Asset ${assetClassId} multiplier saved successfully for Round ${selectedRound}!`);
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

      setSuccess(`Asset ${assetClassId} value deleted successfully for Round ${selectedRound}!`);
      
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

  const configuredCount = assetClasses.filter(ac => !!assetValues[ac.id]).length;

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
              💲
            </span>
            Asset Pricing & Multipliers Management
          </h3>
          <p className="bmc-card-subtitle">
            Configure round-specific market prices across all 7 asset classes for simulation evaluation
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${configuredCount === assetClasses.length && assetClasses.length > 0 ? 'badge-running' : 'badge-allocation'}`}>
            <span className="badge-dot" />
            Round {selectedRound}: {configuredCount} / {assetClasses.length} Configured
          </span>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-error" role="alert">
          <span><strong>Asset Value Error:</strong> {error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success" role="status">
          <span>{success}</span>
        </div>
      )}

      {/* Round Selection Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label htmlFor="roundSelect" className="form-label" style={{ margin: 0, fontWeight: 600 }}>
            Active Target Round:
          </label>
          <select 
            id="roundSelect" 
            value={selectedRound} 
            onChange={handleRoundChange}
            className="form-select"
            style={{ width: '130px', padding: '0.45rem 0.65rem' }}
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map(r => (
              <option key={r} value={r}>Round {r}</option>
            ))}
          </select>
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Changes take effect upon clicking &quot;Save&quot; for each asset.
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite', marginRight: '0.5rem' }} />
          Loading asset values for Round {selectedRound}...
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Asset Class</th>
                <th style={{ width: '25%' }}>Value Multiplier</th>
                <th style={{ width: '20%' }}>Status</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assetClasses.map(ac => {
                const isConfigured = !!assetValues[ac.id];
                return (
                  <tr key={ac.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {ac.name}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '160px' }}>
                        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>₹</span>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0.01"
                          value={inputValues[ac.id] || ''} 
                          onChange={(e) => handleInputChange(ac.id, e.target.value)}
                          className="form-input form-input-mono"
                          style={{ padding: '0.4rem 0.6rem' }}
                          placeholder="0.00"
                          aria-label={`Multiplier for ${ac.name}`}
                        />
                      </div>
                    </td>
                    <td>
                      {isConfigured ? (
                        <span className="badge badge-running">
                          <span className="badge-dot" />
                          Configured
                        </span>
                      ) : (
                        <span className="badge badge-setup">
                          <span className="badge-dot" />
                          Unset
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button 
                          type="button"
                          onClick={() => handleSave(ac.id)}
                          className="btn btn-success btn-sm"
                        >
                          Save
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDelete(ac.id)}
                          disabled={!isConfigured}
                          className="btn btn-danger btn-sm"
                          style={{ opacity: !isConfigured ? 0.4 : 1 }}
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

export default AssetValueManagement;
