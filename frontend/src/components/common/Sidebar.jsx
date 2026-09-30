import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  LuLayoutDashboard,
  LuPackage,
  LuTag,
  LuUsers,
  LuShoppingCart,
  LuUserCog,
  LuScrollText,
  LuCreditCard,
  LuUndo2,
  LuStar,
  LuTruck,
  LuClipboardList,
  LuLogOut,
  LuChevronLeft,
  LuChevronRight,
} from 'react-icons/lu';
import AppLogo from './AppLogo';
import './Sidebar.css';

// ── Nav definitions per role ────────────────────────────────────────────────
const NAV_BY_ROLE = {
  Administrator: [
    { path: '/dashboard',  icon: LuLayoutDashboard, label: 'Dashboard',  color: '#0d9488' },
    { path: '/products',   icon: LuPackage,         label: 'Products',   color: '#0ea5e9' },
    { path: '/categories', icon: LuTag,             label: 'Categories', color: '#10b981' },
    { path: '/suppliers',  icon: LuTruck,           label: 'Suppliers',  color: '#0891b2' },
    { path: '/purchase-orders', icon: LuClipboardList, label: 'Purchase Orders', color: '#2563eb' },
    { path: '/clients',    icon: LuUsers,           label: 'Clients',    color: '#f59e0b' },
    { path: '/orders',     icon: LuShoppingCart,    label: 'Orders',     color: '#8b5cf6' },
    { path: '/returns',    icon: LuUndo2,           label: 'Returns',    color: '#f97316' },
    { path: '/feedback',   icon: LuStar,            label: 'Feedback',   color: '#eab308' },
    { path: '/users',      icon: LuUserCog,         label: 'Users',      color: '#ec4899' },
    { path: '/payment-settings', icon: LuCreditCard, label: 'Payments',  color: '#14b8a6' },
    { path: '/audit-logs', icon: LuScrollText,      label: 'Audit Logs', color: '#64748b' },
  ],
  Manager: [
    { path: '/dashboard',  icon: LuLayoutDashboard, label: 'Dashboard',  color: '#2563eb' },
    { path: '/products',   icon: LuPackage,         label: 'Products',   color: '#0ea5e9' },
    { path: '/categories', icon: LuTag,             label: 'Categories', color: '#0284c7' },
    { path: '/suppliers',  icon: LuTruck,           label: 'Suppliers',  color: '#0891b2' },
    { path: '/purchase-orders', icon: LuClipboardList, label: 'Purchase Orders', color: '#2563eb' },
    { path: '/clients',    icon: LuUsers,           label: 'Clients',    color: '#0369a1' },
    { path: '/orders',     icon: LuShoppingCart,    label: 'Orders',     color: '#1d4ed8' },
    { path: '/returns',    icon: LuUndo2,           label: 'Returns',    color: '#f97316' },
    { path: '/feedback',   icon: LuStar,            label: 'Feedback',   color: '#eab308' },
  ],
  'Sales Agent': [
    { path: '/dashboard',  icon: LuLayoutDashboard, label: 'Dashboard',  color: '#22c55e' },
    { path: '/orders',     icon: LuShoppingCart,    label: 'Orders',     color: '#16a34a' },
    { path: '/clients',    icon: LuUsers,           label: 'Clients',    color: '#15803d' },
    { path: '/products',   icon: LuPackage,         label: 'Products',   color: '#0ea5e9' },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isActive = (path) => location.pathname === path;

  const navItems = NAV_BY_ROLE[user?.role_name] || NAV_BY_ROLE['Manager'];

  // Role-specific accent colors for sidebar header
  const ROLE_THEME = {
    'Administrator': { accent: '#0d9488', bg: 'linear-gradient(135deg,#0d9488,#0891b2)', label: 'Full Access' },
    'Manager':       { accent: '#2563eb', bg: 'linear-gradient(135deg,#2563eb,#1d4ed8)', label: 'Management' },
    'Sales Agent':   { accent: '#16a34a', bg: 'linear-gradient(135deg,#16a34a,#15803d)', label: 'Sales' },
  };
  const theme = ROLE_THEME[user?.role_name] || ROLE_THEME['Manager'];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Role accent strip at top */}
      <div style={{ height: 3, background: theme.bg, borderRadius: '0' }} />

      {/* Logo */}
      <div className="sidebar-logo">
        <AppLogo size={collapsed ? 32 : 34} showText={!collapsed} />
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar">
          {collapsed ? <LuChevronRight size={15} /> : <LuChevronLeft size={15} />}
        </button>
      </div>

      {/* User info with role-themed accent */}
      {!collapsed && (
        <div className="sidebar-user" style={{ background: theme.accent + '15', borderLeft: `3px solid ${theme.accent}` }}>
          <div className="user-avatar" style={{ background: theme.bg, boxShadow: `0 4px 12px ${theme.accent}40` }}>
            {user?.firstname?.[0]}{user?.lastname?.[0]}
          </div>
          <div className="user-info">
            <p className="user-name">{user?.firstname} {user?.lastname}</p>
            <span style={{
              display: 'inline-block',
              background: theme.accent,
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '0.1rem 0.5rem',
              borderRadius: '999px',
              letterSpacing: '0.04em',
            }}>
              {user?.role_name}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {!collapsed && <p className="nav-section-label">Main Menu</p>}
        {navItems.map(item => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${active ? 'active' : ''}`}
              title={collapsed ? item.label : ''}
            >
              <span
                className="nav-icon-wrap"
                style={{
                  background: active ? item.color + '22' : 'transparent',
                  color: active ? item.color : undefined,
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {!collapsed && active && <span className="nav-dot" style={{ background: item.color }} />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="sidebar-footer">
        <button className="nav-item logout-item" onClick={handleLogout} title={collapsed ? 'Logout' : ''}>
          <span className="nav-icon-wrap"><LuLogOut size={18} strokeWidth={1.8} /></span>
          {!collapsed && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
