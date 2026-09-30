import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { notifyInfo, notifyError } from '../../utils/uxHelpers';
import { notificationService } from '../../services/api';
import DarkModeToggle from './DarkModeToggle';
import {
  LuLayoutDashboard, LuPackage, LuTag, LuUsers,
  LuShoppingCart, LuUserCog, LuScrollText, LuBell, LuTruck, LuClipboardList,
} from 'react-icons/lu';
import './TopBar.css';

const PAGE_META = {
  '/dashboard':  { title: 'Dashboard',   subtitle: 'Overview of your activity',            icon: LuLayoutDashboard, color: '#0d9488', bg: '#f0fdfa' },
  '/products':   { title: 'Products',    subtitle: 'Manage your product catalog',           icon: LuPackage,         color: '#0ea5e9', bg: '#e0f2fe' },
  '/categories': { title: 'Categories',  subtitle: 'Organize your products by category',   icon: LuTag,             color: '#10b981', bg: '#d1fae5' },
  '/suppliers':  { title: 'Suppliers',   subtitle: 'Manage who you restock from',           icon: LuTruck,           color: '#0891b2', bg: '#ecfeff' },
  '/purchase-orders': { title: 'Purchase Orders', subtitle: 'Restock your products',        icon: LuClipboardList,   color: '#2563eb', bg: '#eff6ff' },
  '/clients':    { title: 'Clients',     subtitle: 'Manage your client portfolio',          icon: LuUsers,           color: '#f59e0b', bg: '#fef3c7' },
  '/orders':     { title: 'Orders',      subtitle: 'Track and manage your orders',          icon: LuShoppingCart,    color: '#8b5cf6', bg: '#ede9fe' },
  '/users':      { title: 'Users',       subtitle: 'Manage access and roles',               icon: LuUserCog,         color: '#ec4899', bg: '#fce7f3' },
  '/audit-logs': { title: 'Audit Logs',  subtitle: 'History of critical actions',           icon: LuScrollText,      color: '#64748b', bg: '#f1f5f9' },
};

// Role badge config — makes the role immediately visible in the header
const ROLE_CONFIG = {
  'Administrator': { color: '#0d9488', bg: '#f0fdfa', label: 'Administrator · Full Access' },
  'Manager':       { color: '#2563eb', bg: '#eff6ff', label: 'Manager · Business Management' },
  'Sales Agent':   { color: '#16a34a', bg: '#f0fdf4', label: 'Sales Agent · Personal View' },
};

/** Decode a JWT payload without verifying signature (client-side only) */
function decodeJwtExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null; // convert to ms
  } catch {
    return null;
  }
}

const WARN_BEFORE_MS = 5 * 60 * 1000; // warn 5 minutes before expiry
const NOTIF_POLL_MS  = 60 * 1000; // 1 minute — frequent enough to feel live, cheap enough to poll

const fmtTND = v => parseFloat(v || 0).toFixed(2) + ' TND';

const EMPTY_NOTIFS = { pendingOrders: { count: 0, items: [] }, lowStock: { count: 0, items: [] } };

export default function TopBar() {
  const { user, token, logout } = useAuthStore();
  const location  = useLocation();
  const navigate  = useNavigate();
  const warnedRef = useRef(false);
  const meta       = PAGE_META[location.pathname];
  const roleConfig = ROLE_CONFIG[user?.role_name];

  // ── Update browser tab title per page ──────────────────────────────────────
  useEffect(() => {
    document.title = meta?.title
      ? `${meta.title} — Dynamix Services`
      : 'Dynamix Services';
  }, [meta?.title]);

  const initials = `${user?.firstname?.[0] || ''}${user?.lastname?.[0] || ''}`.toUpperCase();
  const Icon = meta?.icon;

  // ── Notifications bell (Administrator/Manager only) ─────────────────────────
  const canSeeNotifications = user?.role_name === 'Administrator' || user?.role_name === 'Manager';
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState(EMPTY_NOTIFS);
  const bellRef = useRef(null);

  const loadNotifications = useCallback(() => {
    if (!canSeeNotifications) return;
    notificationService.get().then(r => setNotifs(r.data)).catch(() => {});
  }, [canSeeNotifications]);

  useEffect(() => {
    if (!canSeeNotifications) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, NOTIF_POLL_MS);
    return () => clearInterval(interval);
  }, [canSeeNotifications, loadNotifications]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const totalNotifCount = notifs.pendingOrders.count + notifs.lowStock.count;

  const goToNotification = (path) => {
    setNotifOpen(false);
    navigate(path);
  };

  // ── Session expiry watcher ──────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const expiry = decodeJwtExpiry(token);
    if (!expiry) return;

    const now = Date.now();
    const msUntilExpiry = expiry - now;
    const msUntilWarn   = msUntilExpiry - WARN_BEFORE_MS;

    if (msUntilExpiry <= 0) {
      // Already expired — log out immediately
      logout();
      navigate('/login');
      return;
    }

    const timers = [];

    // Schedule the 5-minute warning
    if (msUntilWarn > 0) {
      timers.push(setTimeout(() => {
        if (!warnedRef.current) {
          warnedRef.current = true;
          notifyInfo('⏱ Your session expires in 5 minutes. Save your work.', 8000);
        }
      }, msUntilWarn));
    }

    // Schedule auto-logout at expiry
    timers.push(setTimeout(() => {
      notifyError('Session expired. Please sign in again.', 5000);
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 1500);
    }, msUntilExpiry));

    return () => timers.forEach(clearTimeout);
  }, [token, logout, navigate]);

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
        {/* Role indicator badge — immediately visible */}
        {roleConfig && (
          <div className="topbar-role-badge" style={{
            background: roleConfig.bg,
            color: roleConfig.color,
            borderColor: `${roleConfig.color}33`,
          }}>
            {roleConfig.label}
          </div>
        )}

        {canSeeNotifications && (
          <div className="topbar-notif" ref={bellRef}>
            <button
              className="topbar-bell"
              onClick={() => { setNotifOpen(o => !o); if (!notifOpen) loadNotifications(); }}
              aria-label="Notifications"
            >
              <LuBell size={19} />
              {totalNotifCount > 0 && (
                <span className="topbar-bell-badge">{totalNotifCount > 99 ? '99+' : totalNotifCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className="topbar-notif-panel">
                <div className="topbar-notif-header">Notifications</div>

                {totalNotifCount === 0 ? (
                  <div className="topbar-notif-empty">You&apos;re all caught up 🎉</div>
                ) : (
                  <>
                    {notifs.pendingOrders.count > 0 && (
                      <div className="topbar-notif-section">
                        <div className="topbar-notif-section-title">
                          Awaiting confirmation ({notifs.pendingOrders.count})
                        </div>
                        {notifs.pendingOrders.items.map(o => (
                          <div key={o.id} className="topbar-notif-item" onClick={() => goToNotification('/orders')}>
                            <LuShoppingCart size={14} className="topbar-notif-item-icon" />
                            <div className="topbar-notif-item-body">
                              <p>Order #{o.id} — {o.client_name || 'Client'}</p>
                              <span>{fmtTND(o.amount_ttc)} · {o.order_date ? new Date(o.order_date).toLocaleDateString('en-GB') : '—'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {notifs.lowStock.count > 0 && (
                      <div className="topbar-notif-section">
                        <div className="topbar-notif-section-title">
                          Low stock ({notifs.lowStock.count})
                        </div>
                        {notifs.lowStock.items.map(p => (
                          <div key={`${p.type}-${p.id}`} className="topbar-notif-item" onClick={() => goToNotification('/products')}>
                            <LuPackage size={14} className="topbar-notif-item-icon" />
                            <div className="topbar-notif-item-body">
                              <p>{p.name}</p>
                              <span>{p.stock} left{p.reference ? ` · ${p.reference}` : ''}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <DarkModeToggle size={36} />

        <div className="topbar-user">
          <div className="topbar-info">
            <span className="topbar-name">{user?.firstname} {user?.lastname}</span>
            <span className="topbar-role" style={{ color: roleConfig?.color }}>{user?.role_name}</span>
          </div>
          <div className="topbar-avatar" style={{
            background: roleConfig
              ? `linear-gradient(135deg, ${roleConfig.color}, ${roleConfig.color}cc)`
              : 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
          }}>{initials}</div>
        </div>
      </div>
    </header>
  );
}
