import React from 'react';
import { useAuth } from '../../context/AuthContext';
import './layout.css';

export const Header = ({ title, children }) => {
  const { currentUser } = useAuth();
  
  return (
    <header className="page-header">
      <div className="header-left">
        <h1 className="text-headline-lg" style={{ margin: 0 }}>{title}</h1>
      </div>
      <div className="header-right">
        {children}
        <div className="user-profile">
          <div className="avatar">
            {currentUser?.email?.charAt(0).toUpperCase()}
          </div>
          <span className="text-body-md" style={{ marginLeft: 'var(--space-sm)' }}>
            {currentUser?.email}
          </span>
        </div>
      </div>
    </header>
  );
};
