import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  FiGrid, FiPackage, FiTag, FiUsers, FiShoppingCart,
  FiUser, FiFileText, FiLogOut, FiBarChart2, FiChevronLeft, FiChevronRight
} from 'react-icons/fi';
import './Sidebar.css';

const NAV = [
  { path: '/dashboard', icon: <FiGrid />,         label: 'Dashboard' },
  { path: '/products',   icon: <FiPackage />,      label: 'Products' },
  { path: '/categories', icon: <FiTag />,          label: 'Categories' },
  { path: '/clients',    icon: <FiUsers />,        label: 'Clients' },
  { path: '/orders',     icon: <FiShoppingCart />, label: 'Orders' },
];

const ADMIN_NAV = [
  { path: '/users',      icon: <FiUser />,     label: 'Users' },
  { path: '/audit-logs', icon: <FiFileText />, label: 'Audit Logs' },
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
        <span className="logo-icon"><FiBarChart2 size={22} /></span>
        {!collapsed && <span className="logo-text" translate="no">Sales Management</span>}
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} title="Toggle sidebar">
          {collapsed ? <FiChevronRight size={16} /> : <FiChevronLeft size={16} />}
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
        {allNav.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
            title={collapsed ? item.label : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
            {!collapsed && isActive(item.path) && <span className="nav-dot" />}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="sidebar-footer">
        <button className="nav-item logout-item" onClick={handleLogout} title={collapsed ? 'Logout' : ''}>
          <span className="nav-icon"><FiLogOut /></span>
          {!collapsed && <span className="nav-label">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
