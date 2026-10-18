import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const CANONICAL_ASSET_NAMES = {
  assetClass1: "Asset Class 1",
  assetClass2: "Asset Class 2",
  assetClass3: "Asset Class 3",
  governmentSecurities: "Government Securities",
  bankFixedDeposits: "Bank Fixed Deposits",
  realEstate: "Real Estate",
  gold: "Gold"
};

const LEGACY_KEY_MAP = {
  '1': 'assetClass1',
  '2': 'assetClass2',
  '3': 'assetClass3',
  '4': 'governmentSecurities',
  '5': 'bankFixedDeposits',
  '6': 'realEstate',
  '7': 'gold'
};

const FD_MODIFIABLE_ROUNDS = [0, 6, 11];

function ParticipantAllocation({ simulationState }) {
  const { currentUser } = useAuth();
  const [allocation, setAllocation] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inputs, setInputs] = useState({
    assetClass1: 0,
    assetClass2: 0,
    assetClass3: 0,
    governmentSecurities: 0,
    bankFixedDeposits: 0,
    realEstate: 0,
    gold: 0
  });

  useEffect(() => {
    fetchAllocation();
  }, [simulationState?.currentRound, simulationState?.status]);

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
        const loaded = {};
        Object.keys(CANONICAL_ASSET_NAMES).forEach(k => {
          loaded[k] = data.allocations[k] ?? 0;
        });

        // Map legacy keys if needed
        for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_KEY_MAP)) {
          if (data.allocations[canonicalKey] === undefined && data.allocations[legacyKey] !== undefined) {
            loaded[canonicalKey] = data.allocations[legacyKey];
          }
        }
        setInputs(loaded);
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

      setSuccess('Allocation draft saved successfully.');
      fetchAllocation();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async () => {
    const roundNumber = allocation?.round ?? simulationState?.currentRound ?? 0;
    if (!window.confirm(`Are you sure you want to submit your Round ${roundNumber} allocation? Once submitted, your allocation is finalized and locked for this round.`)) {
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

      setSuccess(`Round ${roundNumber} allocation submitted and locked successfully.`);
      fetchAllocation();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="bmc-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge-dot" style={{ background: 'var(--accent-electric)', animation: 'pulse-dot 1.2s infinite' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading allocation workbench...</span>
        </div>
      </div>
    );
  }

  if (error === 'You are not assigned to a team.') {
    return (
      <div className="bmc-card">
        <div className="bmc-card-header">
          <h3 className="bmc-card-title">Portfolio Allocation</h3>
        </div>
        <div className="alert alert-warning">
          <span>You are not assigned to a team yet. Please wait for an administrator to assign your squad.</span>
        </div>
      </div>
    );
  }

  const currentRound = allocation?.round ?? simulationState?.currentRound ?? 0;
  const isRound0 = currentRound === 0;
  const availableCapital = allocation?.availableCapital || (isRound0 ? 1000000 : 0);
  const isSubmitted = allocation?.status === 'SUBMITTED';
  const isReallocationOpen = allocation?.isReallocationOpen ?? false;
  const canEdit = isReallocationOpen && !isSubmitted;
  const isFdModifiable = FD_MODIFIABLE_ROUNDS.includes(currentRound);

  const totalAllocated = Object.values(inputs).reduce((sum, val) => sum + (val || 0), 0);
  const unallocatedCash = availableCapital - totalAllocated;
  const percentAllocated = availableCapital > 0 
    ? Math.min(100, Math.max(0, (totalAllocated / availableCapital) * 100))
    : 0;
  const isOverBudget = unallocatedCash < 0;

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
              background: isRound0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              color: isRound0 ? 'var(--warning-light)' : 'var(--accent-electric)',
              fontSize: '0.85rem'
            }}>
              ⚖️
            </span>
            {isRound0 ? 'Initial Portfolio Allocation (Round 0)' : `Portfolio Reallocation Desk (Round ${currentRound})`}
          </h3>
          <p className="bmc-card-subtitle">
            {isRound0 
              ? `Deploy starting capital of ₹${availableCapital.toLocaleString('en-IN')} for ${teamName || 'your squad'} across the 7 asset classes.`
              : `Rebalance your current portfolio value of ₹${availableCapital.toLocaleString('en-IN')} for ${teamName || 'your squad'} across assets and cash.`
            }
          </p>
        </div>
        <span className={`badge ${isSubmitted ? 'badge-running' : isReallocationOpen ? 'badge-allocation' : 'badge-setup'}`}>
          <span className="badge-dot" />
          {isSubmitted 
            ? 'Status: SUBMITTED (Locked)' 
            : isReallocationOpen 
            ? 'Phase: REALLOCATION OPEN' 
            : 'Status: REALLOCATION LOCKED'}
        </span>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span><strong>Allocation Error:</strong> {error}</span>
        </div>
      )}
      {success && (
        <div className="alert alert-success" role="status">
          <span>{success}</span>
        </div>
      )}

      {/* Status Messages */}
      {isSubmitted && (
        <div className="alert alert-info">
          <span>
            <strong>Allocation Locked:</strong> Your Round {currentRound} allocation of ₹{totalAllocated.toLocaleString('en-IN')} (with ₹{unallocatedCash.toLocaleString('en-IN')} in cash) has been finalized and submitted.
          </span>
        </div>
      )}

      {!isReallocationOpen && !isSubmitted && (
        <div className="alert alert-warning">
          <span>
            <strong>Reallocation Window Closed:</strong> Portfolio adjustments are locked for Round {currentRound}. Inputs are displayed in read-only mode until reallocation is opened by the event administrator.
          </span>
        </div>
      )}

      {/* Budget Summary Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        padding: '1.25rem',
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        marginBottom: '1.5rem'
      }}>
        <div>
          <span className="bmc-stat-label">Available Portfolio Capital</span>
          <div className="bmc-stat-value" style={{ fontSize: '1.35rem' }}>₹{availableCapital.toLocaleString('en-IN')}</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {isRound0 ? 'Genesis starting allotment' : `Total value for Round ${currentRound}`}
          </span>
        </div>
        <div>
          <span className="bmc-stat-label">Allocated to Assets</span>
          <div className="bmc-stat-value" style={{ fontSize: '1.35rem', color: isOverBudget ? 'var(--loss-light)' : 'var(--accent-electric)' }}>
            ₹{totalAllocated.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{percentAllocated.toFixed(1)}% of available capital</span>
        </div>
        <div>
          <span className="bmc-stat-label">Remaining Liquid Cash</span>
          <div className="bmc-stat-value" style={{
            fontSize: '1.35rem',
            color: isOverBudget ? 'var(--loss-light)' : 'var(--gain-light)'
          }}>
            ₹{unallocatedCash.toLocaleString('en-IN')}
          </div>
          <span style={{ fontSize: '0.75rem', color: isOverBudget ? 'var(--loss-light)' : 'var(--text-muted)' }}>
            {isOverBudget ? `Exceeds ₹${availableCapital.toLocaleString('en-IN')} limit!` : 'Uninvested cash reserve'}
          </span>
        </div>
      </div>

      {/* Progress Track */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
          <span>Capital Deployed</span>
          <span>{percentAllocated.toFixed(1)}%</span>
        </div>
        <div className="progress-track">
          <div 
            className={`progress-bar ${isOverBudget ? 'progress-bar-danger' : 'progress-bar-electric'}`}
            style={{ 
              width: `${Math.min(100, percentAllocated)}%`,
              backgroundColor: isOverBudget ? 'var(--loss-red)' : undefined
            }}
          />
        </div>
      </div>

      {/* Allocation Inputs Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '45%' }}>Asset Class</th>
              <th style={{ width: '35%' }}>Allocation Amount (₹)</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Weight</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(CANONICAL_ASSET_NAMES).map(([key, name]) => {
              const val = inputs[key] || 0;
              const weight = availableCapital > 0 ? ((val / availableCapital) * 100).toFixed(1) : '0.0';
              const isFdField = key === 'bankFixedDeposits';
              const isLockedFd = isFdField && !isFdModifiable;
              const inputDisabled = !canEdit || isLockedFd;

              return (
                <tr key={key}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</span>
                      {isLockedFd && (
                        <span style={{ fontSize: '0.725rem', color: 'var(--warning-light)', marginTop: '0.2rem' }}>
                          🔒 Locked (Modifiable only in Rounds 0, 6, 11)
                        </span>
                      )}
                      {isFdField && isFdModifiable && (
                        <span style={{ fontSize: '0.725rem', color: 'var(--gain-light)', marginTop: '0.2rem' }}>
                          🔓 Modifiable in Round {currentRound}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '220px' }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>₹</span>
                      <input 
                        type="number" 
                        min="0"
                        step="1"
                        value={inputs[key] === 0 ? '' : inputs[key]} 
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        disabled={inputDisabled}
                        className="form-input form-input-mono"
                        style={{ 
                          padding: '0.45rem 0.65rem',
                          background: isLockedFd ? 'rgba(30, 41, 59, 0.4)' : undefined,
                          borderColor: isLockedFd ? 'var(--border-subtle)' : undefined,
                          cursor: isLockedFd ? 'not-allowed' : undefined
                        }}
                        placeholder="0"
                        aria-label={`Allocation amount for ${name}`}
                      />
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {weight}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      {canEdit && (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button 
            type="button"
            onClick={handleSaveDraft}
            className="btn btn-secondary"
          >
            💾 Save Draft
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={isOverBudget}
            className="btn btn-success"
          >
            🚀 Submit Final Allocation
          </button>
        </div>
      )}
    </div>
  );
}

export default ParticipantAllocation;
