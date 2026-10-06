import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import './layout.css';

export const PageContainer = ({ title, sidebarLinks = [], children, headerActions }) => {
  return (
    <div className="layout-container">
      <Sidebar links={sidebarLinks} />
      <div className="layout-main">
        <Header title={title}>{headerActions}</Header>
        <main className="layout-content">
          {children}
        </main>
      </div>
    </div>
  );
};
