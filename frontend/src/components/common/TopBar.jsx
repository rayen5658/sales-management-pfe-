import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  LuLayoutDashboard, LuPackage, LuTag, LuUsers,
  LuShoppingCart, LuUserCog, LuScrollText,
} from 'react-icons/lu';
import './TopBar.css';

const PAGE_META = {
  '/dashboard':  { title: 'Dashboard',   subtitle: 'Overview of your activity',            icon: LuLayoutDashboard, color: '#6366f1', bg: '#eef2ff' },
  '/products':   { title: 'Products',    subtitle: 'Manage your product catalog',           icon: LuPackage,         color: '#0ea5e9', bg: '#e0f2fe' },
  '/categories': { title: 'Categories',  subtitle: 'Organize your products by category',   icon: LuTag,             color: '#10b981', bg: '#d1fae5' },
  '/clients':    { title: 'Clients',     subtitle: 'Manage your client portfolio',          icon: LuUsers,           color: '#f59e0b', bg: '#fef3c7' },
  '/orders':     { title: 'Orders',      subtitle: 'Track and manage your orders',          icon: LuShoppingCart,    color: '#8b5cf6', bg: '#ede9fe' },
  '/users':      { title: 'Users',       subtitle: 'Manage access and roles',              icon: LuUserCog,         color: '#ec4899', bg: '#fce7f3' },
  '/audit-logs': { title: 'Audit Logs',  subtitle: 'History of critical actions',          icon: LuScrollText,      color: '#64748b', bg: '#f1f5f9' },
};

export default function TopBar() {
  const { user } = useAuthStore();
  const location = useLocation();
  const meta = PAGE_META[location.pathname];

  const initials = `${user?.firstname?.[0] || ''}${user?.lastname?.[0] || ''}`.toUpperCase();
  const Icon = meta?.icon;

  return (
    <header className="topbar">
      <div className="topbar-left">
        {Icon && (
          <div className="topbar-page-icon" style={{ background: meta.bg, color: meta.color }}>
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
        <div>
          <h2 className="topbar-title">{meta?.title ?? 'Sales Manager'}</h2>
          {meta?.subtitle && <p className="topbar-subtitle">{meta.subtitle}</p>}
        </div>
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
