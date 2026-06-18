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
  LuLogOut,
  LuChevronLeft,
  LuChevronRight,
} from 'react-icons/lu';
import AppLogo from './AppLogo';
import './Sidebar.css';

const NAV = [
  { path: '/dashboard', icon: LuLayoutDashboard, label: 'Dashboard',  color: '#6366f1' },
  { path: '/products',  icon: LuPackage,         label: 'Products',   color: '#0ea5e9' },
  { path: '/categories',icon: LuTag,             label: 'Categories', color: '#10b981' },
  { path: '/clients',   icon: LuUsers,           label: 'Clients',    color: '#f59e0b' },
  { path: '/orders',    icon: LuShoppingCart,    label: 'Orders',     color: '#8b5cf6' },
];

const ADMIN_NAV = [
  { path: '/users',      icon: LuUserCog,    label: 'Users',      color: '#ec4899' },
  { path: '/audit-logs', icon: LuScrollText, label: 'Audit Logs', color: '#64748b' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isActive = (path) => location.pathname === path;

  const allNav = user?.role_name === 'Administrator' ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <AppLogo size={collapsed ? 32 : 34} showText={!collapsed} />
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar">
          {collapsed ? <LuChevronRight size={15} /> : <LuChevronLeft size={15} />}
        </button>
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="sidebar-user">
          <div className="user-avatar">{user?.firstname?.[0]}{user?.lastname?.[0]}</div>
          <div className="user-info">
            <p className="user-name">{user?.firstname} {user?.lastname}</p>
            <span className={`badge badge-${user?.role_name}`}>{user?.role_name}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {!collapsed && <p className="nav-section-label">Main Menu</p>}
        {allNav.map(item => {
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
