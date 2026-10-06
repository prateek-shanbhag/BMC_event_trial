import React from 'react';
import { useAuth } from '../../context/AuthContext';
import './layout.css';

export const Sidebar = ({ links = [] }) => {
  const { logout, role } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2 className="text-headline-sm" style={{ margin: 0, color: '#ffffff' }}>BMC Simulator</h2>
        <div className="text-label-caps" style={{ color: 'var(--color-tertiary)' }}>{role}</div>
      </div>
      
      <nav className="sidebar-nav">
        {links.map((link, index) => (
          <a key={index} href={link.href} className={`sidebar-link ${link.active ? 'active' : ''}`}>
            {link.label}
          </a>
        ))}
      </nav>
      
      <div className="sidebar-footer">
        <button onClick={logout} className="sidebar-link text-danger" style={{ background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
    </aside>
  );
};
