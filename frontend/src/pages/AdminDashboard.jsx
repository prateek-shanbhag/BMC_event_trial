import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const AdminDashboard = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const sidebarLinks = [
    { label: 'Dashboard', href: '/admin/dashboard', active: currentPath === '/admin/dashboard' || currentPath === '/admin' },
    { label: 'Rounds & Control', href: '/admin/rounds', active: currentPath.includes('/admin/rounds') },
    { label: 'News Management', href: '/admin/news', active: currentPath.includes('/admin/news') },
    { label: 'Assets & Markets', href: '/admin/assets', active: currentPath.includes('/admin/assets') },
    { label: 'Teams', href: '/admin/teams', active: currentPath.includes('/admin/teams') },
    { label: 'Leaderboard', href: '/admin/leaderboard', active: currentPath.includes('/admin/leaderboard') },
    { label: 'Results', href: '/admin/results', active: currentPath.includes('/admin/results') },
  ];

  return (
    <PageContainer 
      title="Admin Dashboard" 
      sidebarLinks={sidebarLinks}
      headerActions={
        <Button variant="primary">Start Game</Button>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        
        <Route path="/dashboard" element={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
              <Card title="Simulation Status">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <p className="text-body-md">Status: <span style={{ color: 'var(--color-tertiary)', fontWeight: 'bold' }}>Not Started</span></p>
                  <p className="text-body-md">Current Round: <span className="tabular-nums">0 / 20</span></p>
                  <p className="text-body-md">Registered Teams: <span className="tabular-nums">0</span></p>
                </div>
              </Card>
              
              <Card title="Quick Actions">
                <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                  <Button variant="secondary">Add Team</Button>
                  <Button variant="secondary">Configure Assets</Button>
                  <Button variant="secondary">Manage News</Button>
                </div>
              </Card>
            </div>
            
            <Card title="Recent Activity">
              <p className="text-body-md" style={{ color: 'var(--color-tertiary)' }}>No recent activity to display.</p>
            </Card>
          </div>
        } />
        
        {/* Placeholder Routes */}
        <Route path="/rounds" element={<Card title="Rounds Management"><p>Placeholder for rounds management.</p></Card>} />
        <Route path="/news" element={<Card title="News Management"><p>Placeholder for news management.</p></Card>} />
        <Route path="/assets" element={<Card title="Assets Configuration"><p>Placeholder for asset configuration.</p></Card>} />
        <Route path="/teams" element={<Card title="Teams Management"><p>Placeholder for teams.</p></Card>} />
        <Route path="/leaderboard" element={<Card title="Leaderboard"><p>Placeholder for leaderboard.</p></Card>} />
        <Route path="/results" element={<Card title="Simulation Results"><p>Placeholder for results.</p></Card>} />
      </Routes>
    </PageContainer>
  );
};

export default AdminDashboard;
