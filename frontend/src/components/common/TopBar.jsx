import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import './TopBar.css';

const PAGE_TITLES = {
  '/dashboard':  { title: 'Dashboard',   subtitle: 'Overview of your activity' },
  '/products':   { title: 'Products',    subtitle: 'Manage your product catalog' },
  '/categories': { title: 'Categories',  subtitle: 'Organize your products by category' },
  '/clients':    { title: 'Clients',     subtitle: 'Manage your client portfolio' },
  '/orders':     { title: 'Orders',      subtitle: 'Track and manage your orders' },
  '/users':      { title: 'Users',       subtitle: 'Manage access and roles' },
  '/audit-logs': { title: 'Audit Logs',  subtitle: 'History of critical actions' },
};

export default function TopBar() {
  const { user } = useAuthStore();
  const location = useLocation();
  const page = PAGE_TITLES[location.pathname] || { title: 'SalesManager', subtitle: '' };

  const initials = `${user?.firstname?.[0] || ''}${user?.lastname?.[0] || ''}`.toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h2 className="topbar-title">{page.title}</h2>
        {page.subtitle && <p className="topbar-subtitle">{page.subtitle}</p>}
      </div>
      <div className="topbar-right">
        <div className="topbar-user">
          <div className="topbar-info">
            <span className="topbar-name">{user?.firstname} {user?.lastname}</span>
            <span className="topbar-role">{user?.role_name}</span>
          </div>
          <div className="topbar-avatar">{initials}</div>
        </div>
      </div>
    </header>
  );
}
