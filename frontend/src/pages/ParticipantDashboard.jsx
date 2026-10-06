import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PageContainer } from '../components/layout/PageContainer';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';

const ParticipantDashboard = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const sidebarLinks = [
    { label: 'Portfolio', href: '/participant/portfolio', active: currentPath === '/participant/portfolio' || currentPath === '/participant' },
    { label: 'News Terminal', href: '/participant/news', active: currentPath.includes('/participant/news') },
    { label: 'Market Data', href: '/participant/market', active: currentPath.includes('/participant/market') },
    { label: 'Leaderboard', href: '/participant/leaderboard', active: currentPath.includes('/participant/leaderboard') },
  ];

  return (
    <PageContainer 
      title="Trading Terminal" 
      sidebarLinks={sidebarLinks}
      headerActions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <div className="text-label-caps" style={{ color: 'var(--color-tertiary)' }}>Round 1 Time</div>
          <div className="text-headline-md tabular-nums" style={{ color: 'var(--color-danger)' }}>02:00</div>
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/participant/portfolio" replace />} />
        
        <Route path="/portfolio" element={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-lg)' }}>
              <StatCard title="Total Portfolio Value" value="₹10,00,000" change="+0.0%" changeType="neutral" />
              <StatCard title="Available Cash" value="₹10,00,000" />
              <StatCard title="Current Rank" value="--" />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-lg)' }}>
              <Card title="Current Allocation" action={<Button variant="primary">Submit Orders</Button>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                  <p className="text-body-md" style={{ color: 'var(--color-tertiary)' }}>7 Asset Classes available for allocation.</p>
                  {/* Allocation table placeholder */}
                  <div style={{ border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-default)', marginTop: 'var(--space-md)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', padding: 'var(--space-sm) var(--space-md)', borderBottom: '1px solid var(--color-border-light)', backgroundColor: '#F8FAFC', fontWeight: '500' }}>
                      <div>Asset</div>
                      <div>Quantity</div>
                      <div>Current Price</div>
                    </div>
                    <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-tertiary)' }}>
                      Allocation table will be rendered here.
                    </div>
                  </div>
                </div>
              </Card>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                <Card title="Breaking News">
                  <p className="text-body-md" style={{ color: 'var(--color-tertiary)' }}>Waiting for Round 1 to begin...</p>
                </Card>
                
                <Card title="Market Movement">
                  <p className="text-body-md" style={{ color: 'var(--color-tertiary)' }}>No market data available yet.</p>
                </Card>
              </div>
            </div>
          </div>
        } />
        
        {/* Placeholder Routes */}
        <Route path="/news" element={<Card title="News Archive"><p>Historical news will appear here.</p></Card>} />
        <Route path="/market" element={<Card title="Market Data"><p>Asset price history will appear here.</p></Card>} />
        <Route path="/leaderboard" element={<Card title="Live Leaderboard"><p>Competition standings will appear here.</p></Card>} />
      </Routes>
    </PageContainer>
  );
};

export default ParticipantDashboard;
