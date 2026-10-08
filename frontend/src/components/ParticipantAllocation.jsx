import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function ParticipantAllocation({ simulationState }) {
  const { currentUser } = useAuth();
  const [allocation, setAllocation] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inputs, setInputs] = useState({
    "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0
  });

  const assetNames = {
    "1": "Asset Class 1",
    "2": "Asset Class 2",
    "3": "Asset Class 3",
    "4": "Government Securities",
    "5": "Bank Fixed Deposits",
    "6": "Real Estate",
    "7": "Gold"
  };

  useEffect(() => {
    fetchAllocation();
  }, []);

  const fetchAllocation = async () => {
    try {
      setLoading(true);
      setError('');
      const token = await currentUser.getIdToken();
      const [allocationRes, teamRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/allocation`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/team`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const data = await allocationRes.json();
      if (!allocationRes.ok) {
        throw new Error(data.error || 'Failed to fetch allocation');
      }

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        if (teamData.team) {
          setTeamName(teamData.team.name);
        }
      }

      setAllocation(data);
      if (data.allocations) {
        setInputs(data.allocations);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (key, value) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;
    setInputs(prev => ({ ...prev, [key]: numValue }));
  };

  const handleSaveDraft = async () => {
    try {
      setError('');
      setSuccess('');
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/allocation`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ allocations: inputs })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save draft');
      }

      setSuccess('Draft saved successfully.');
      fetchAllocation();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async () => {
    if (!window.confirm('Are you sure you want to submit? This action cannot be undone.')) {
      return;
    }
    
    try {
      setError('');
      setSuccess('');
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/participant/allocation/submit`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ allocations: inputs })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit allocation');
      }

      setSuccess('Initial allocation submitted successfully.');
      fetchAllocation();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', gridColumn: '1 / -1' }}>Loading allocation...</div>;
  }

  if (error === 'You are not assigned to a team.') {
    return (
      <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', gridColumn: '1 / -1' }}>
        <h3>Initial Portfolio Allocation</h3>
        <p style={{ color: 'red' }}>You are not assigned to a team yet.</p>
      </div>
    );
  }

  // Only show this component during Round 0 ALLOCATION phase
  if (simulationState && (simulationState.currentRound !== 0 || simulationState.status !== 'ALLOCATION')) {
    return null;
  }

  const isSubmitted = allocation?.status === 'SUBMITTED';
  const totalAllocated = Object.values(inputs).reduce((sum, val) => sum + (val || 0), 0);
  const unallocated = 1000000 - totalAllocated;

  return (
    <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', gridColumn: '1 / -1' }}>
      <h3>Initial Portfolio Allocation</h3>
      {error && <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}
      {success && <div style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{success}</div>}
      
      {isSubmitted && (
        <div style={{ backgroundColor: '#e3f2fd', color: '#1565c0', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontWeight: 'bold' }}>
          Allocation Status: SUBMITTED<br/>
          Your initial allocation has been submitted and is locked.
        </div>
      )}

      {allocation && (
        <div style={{ marginBottom: '20px' }}>
          {teamName && <p><strong>Team:</strong> {teamName}</p>}
          <p><strong>Starting Capital:</strong> ₹10,00,000</p>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Asset Class</th>
            <th style={{ padding: '10px', borderBottom: '2px solid #ddd' }}>Allocation (₹)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(assetNames).map(([key, name]) => (
            <tr key={key} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px' }}>{name}</td>
              <td style={{ padding: '10px' }}>
                <input 
                  type="number" 
                  min="0"
                  step="1"
                  value={inputs[key] === 0 ? '' : inputs[key]} 
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  disabled={isSubmitted}
                  style={{ padding: '6px', width: '150px', borderRadius: '4px', border: '1px solid #ccc' }}
                  placeholder="0"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginBottom: '20px', fontSize: '1.1em' }}>
        <p><strong>Total Allocated:</strong> ₹{totalAllocated.toLocaleString('en-IN')}</p>
        <p style={{ color: unallocated < 0 ? 'red' : 'inherit' }}>
          <strong>Unallocated:</strong> ₹{unallocated.toLocaleString('en-IN')}
        </p>
      </div>

      {!isSubmitted && (
        <div>
          <button 
            onClick={handleSaveDraft}
            style={{ padding: '8px 16px', marginRight: '10px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Save Draft
          </button>
          <button 
            onClick={handleSubmit}
            style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Submit Final Allocation
          </button>
        </div>
      )}
    </div>
  );
}

export default ParticipantAllocation;
