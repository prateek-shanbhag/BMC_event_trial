import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import TeamManagement from '../components/TeamManagement';
import NewsManagement from '../components/NewsManagement';
import AssetValueManagement from '../components/AssetValueManagement';
import SimulationControl from '../components/SimulationControl';
import AdminPortfolioManagement from '../components/AdminPortfolioManagement';
import Leaderboard from '../components/Leaderboard';

function AdminDashboard() {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('simulation');

  const tabs = [
    { id: 'simulation', label: '⚙️ Simulation Control', desc: 'Game lifecycle & round progression' },
    { id: 'portfolios', label: '📊 Portfolio Monitoring', desc: 'Squad holdings, valuations & history' },
    { id: 'assets', label: '💲 Asset Pricing', desc: 'Round-by-round multipliers' },
    { id: 'news', label: '📰 Market Intelligence', desc: 'Macro bulletins & announcements' },
    { id: 'teams', label: '👥 Team Rosters', desc: 'Squad creation & assignments' },
    { id: 'leaderboard', label: '🏆 Standings', desc: 'Official final tournament results' },
    { id: 'all', label: '📋 All Panels', desc: 'Unified full-screen view' }
  ];

  return (
    <div className="bmc-shell animate-fade-in">
      {/* Top Header Bar */}
      <header className="bmc-topbar">
        <div className="bmc-brand">
          <div className="bmc-logo-mark">BMC</div>
          <div className="bmc-brand-text">
            <h1>BMC Investment Simulator</h1>
            <span className="bmc-brand-sub" style={{ color: 'var(--warning-light)' }}>
              Mission Control &bull; Admin Desk
            </span>
          </div>
        </div>

        <div className="bmc-topbar-actions">
          <span className="badge badge-allocation" style={{ textTransform: 'none', letterSpacing: 'normal' }}>
            <span className="badge-dot" style={{ background: 'var(--warning-amber)' }} />
            Administrator Mode
          </span>

          <div className="bmc-user-pill">
            <span style={{ color: 'var(--text-secondary)' }}>{currentUser?.email}</span>
            <span className="role-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning-light)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              ADMIN
            </span>
          </div>

          <button 
            type="button"
            onClick={logout} 
            className="btn btn-danger btn-sm"
            aria-label="Logout from admin mission control"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Segmented Admin Operations Navigation */}
      <nav className="bmc-tab-nav" aria-label="Admin modules navigation">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)} 
            className={`bmc-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            title={tab.desc}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {activeTab === 'simulation' && (
          <SimulationControl />
        )}

        {activeTab === 'portfolios' && (
          <AdminPortfolioManagement />
        )}

        {activeTab === 'assets' && (
          <AssetValueManagement />
        )}

        {activeTab === 'news' && (
          <NewsManagement />
        )}

        {activeTab === 'teams' && (
          <TeamManagement />
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard isAdmin={true} />
        )}

        {activeTab === 'all' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            <SimulationControl />
            <AdminPortfolioManagement />
            <AssetValueManagement />
            <NewsManagement />
            <TeamManagement />
            <Leaderboard isAdmin={true} />
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
