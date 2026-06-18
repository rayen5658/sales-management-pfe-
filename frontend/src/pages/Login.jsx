import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useClientAuthStore } from '../stores/clientAuthStore';
import AppLogo from '../components/common/AppLogo';

// ── SVG Icon set — replaces emoji throughout Login ────────────────────────────
function IconChart()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>; }
function IconPackage()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconUsers()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconLock()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function IconShop()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>; }
function IconCart()     { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>; }
function IconTracking() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconHistory()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>; }
function IconShield()   { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IconBuilding() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 22V12h6v10"/><path d="M9 7h1"/><path d="M14 7h1"/><path d="M9 12h1"/><path d="M14 12h1"/></svg>; }

// ── Eye icon ──────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

// ── Shared input ──────────────────────────────────────────────────────────────
const baseInputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  border: '1.5px solid #e5e7eb',
  borderRadius: '10px',
  fontSize: '0.95rem',
  outline: 'none',
  background: '#f9fafb',
  color: '#111827',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: 'inherit',
};

function Input({ type, value, onChange, placeholder, disabled, autoComplete, rightSlot }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={type || 'text'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        style={{ ...baseInputStyle, paddingRight: rightSlot ? '2.75rem' : '1rem' }}
        onFocus={e => {
          e.target.style.borderColor = '#4f46e5';
          e.target.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.12)';
          e.target.style.background = '#fff';
        }}
        onBlur={e => {
          e.target.style.borderColor = '#e5e7eb';
          e.target.style.boxShadow = 'none';
          e.target.style.background = '#f9fafb';
        }}
      />
      {rightSlot && (
        <div style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}>
          {rightSlot}
        </div>
      )}
    </div>
  );
}

// ── Right branded panel ───────────────────────────────────────────────────────
function BrandPanel({ role }) {
  const isClient = role === 'client';

  const adminFeatures = [
    { icon: <IconChart />,    title: 'Real-time Dashboard',  desc: 'KPIs, revenue trends and regional sales at a glance', tooltip: 'View total revenue, top products, top clients and sales by region — all updated live.' },
    { icon: <IconPackage />,  title: 'Order Management',     desc: 'Create, track and update orders with full status history', tooltip: 'Create orders, update their status (pending → confirmed → shipped → delivered), cancel with reason and view full history.' },
    { icon: <IconUsers />,    title: 'Client Management',    desc: 'Manage your client portfolio with archive and restore', tooltip: 'Add clients, edit their info, view order history, enable portal access and archive/restore as needed.' },
    { icon: <IconLock />,     title: 'Role-based Access',    desc: 'Administrator, Manager and Sales Agent permissions', tooltip: 'Each role has specific permissions. Admins manage users and audit logs. Managers handle orders and clients. Sales Agents create orders.' },
  ];

  const clientFeatures = [
    { icon: <IconShop />,     title: 'Browse Products',      desc: 'Search and filter the full product catalog', tooltip: 'Search by name or reference, filter by category, and see real-time stock availability.' },
    { icon: <IconCart />,     title: 'Place Orders',         desc: 'Add to cart, review summary and confirm your order', tooltip: 'Add products to your cart, adjust quantities, add notes and review the full order summary before confirming.' },
    { icon: <IconTracking />, title: 'Track Your Orders',    desc: 'Follow status from pending to delivered in real time', tooltip: 'See exactly where your order is: pending, confirmed, shipped or delivered — with timestamps.' },
    { icon: <IconHistory />,  title: 'Order History',        desc: 'View all your past orders and their details', tooltip: 'Access your complete order history with amounts, dates, status and line-by-line product details.' },
  ];

  const features = isClient ? clientFeatures : adminFeatures;

  const stats = isClient
    ? [{ v: '100%', l: 'Online' }, { v: '24/7', l: 'Access' }, { v: 'Live', l: 'Tracking' }]
    : [{ v: '3', l: 'User Roles' }, { v: '5', l: 'Modules' }, { v: 'Live', l: 'Analytics' }];

  return (
    <div style={{
      flex: 1,
      background: isClient
        ? 'linear-gradient(145deg,#312e81 0%,#4f46e5 55%,#7c3aed 100%)'
        : 'linear-gradient(145deg,#1e1b4b 0%,#3730a3 55%,#4f46e5 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '3rem 2.5rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative orbs */}
      <div style={{ position: 'absolute', width: 380, height: 380, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: -120, right: -120, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', bottom: -80, left: -80, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', top: '45%', right: '8%', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Brand */}
        <div style={{ marginBottom: '2rem' }}>
          <AppLogo size={48} showText={true} inverted={true} />
        </div>

        {/* Headline */}
        <h2 style={{ color: '#fff', fontSize: 'clamp(1.3rem,1.9vw,1.75rem)', fontWeight: 900, lineHeight: 1.2, margin: '0 0 0.7rem', letterSpacing: '-0.02em' }}>
          {isClient
            ? 'Your orders, tracked from placement to delivery.'
            : 'Everything your sales team needs — in one place.'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.87rem', lineHeight: 1.65, margin: '0 0 1.5rem', maxWidth: '38ch' }}>
          {isClient
            ? 'Browse products, place orders and follow their status in real time through your dedicated portal.'
            : 'Manage clients, products and orders. Track KPIs, monitor stock and control access by role.'}
        </p>

        {/* Stat pills */}
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {stats.map(s => (
            <div key={s.l} style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '999px',
              padding: '0.3rem 0.85rem',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <span style={{ fontWeight: 900, color: '#fff', fontSize: '0.88rem' }}>{s.v}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.76rem' }}>{s.l}</span>
            </div>
          ))}
        </div>

        {/* Feature cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {features.map(f => (
            <div key={f.title} style={{
              display: 'flex', alignItems: 'center', gap: '0.85rem',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.11)',
              borderRadius: '12px',
              padding: '0.7rem 0.9rem',
              position: 'relative',
              cursor: 'default',
            }}
              onMouseEnter={e => {
                const tip = e.currentTarget.querySelector('.feat-tip');
                if (tip) tip.style.opacity = '1';
                if (tip) tip.style.transform = 'translateY(0)';
                if (tip) tip.style.pointerEvents = 'none';
              }}
              onMouseLeave={e => {
                const tip = e.currentTarget.querySelector('.feat-tip');
                if (tip) tip.style.opacity = '0';
                if (tip) tip.style.transform = 'translateY(4px)';
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: '9px', flexShrink: 0,
                background: 'rgba(255,255,255,0.11)',
                border: '1px solid rgba(255,255,255,0.16)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.9)',
              }}>{f.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.83rem' }}>{f.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', marginTop: '0.1rem', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
              {/* Tooltip */}
              <div className="feat-tip" style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: '50%',
                transform: 'translateX(-50%) translateY(4px)',
                background: '#1e1b4b',
                color: '#e2e8f0',
                padding: '0.55rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.76rem',
                lineHeight: 1.5,
                whiteSpace: 'normal',
                width: 240,
                textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                opacity: 0,
                transition: 'opacity 0.18s, transform 0.18s',
                zIndex: 10,
                pointerEvents: 'none',
              }}>
                {f.tooltip}
                {/* Arrow */}
                <div style={{
                  position: 'absolute', bottom: -5, left: '50%',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: 10, height: 10,
                  background: '#1e1b4b',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderTop: 'none', borderLeft: 'none',
                }} />
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── Role selector ─────────────────────────────────────────────────────────────
function RoleSelector({ onSelect }) {
  const navigate = useNavigate();
  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '1.9rem', fontWeight: 900, color: '#111827', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
          Welcome Back
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', margin: 0 }}>
          Choose how you want to sign in
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {[
          { role: 'admin',  icon: <IconShield />,   title: 'Admin / Staff',  sub: 'Administrators, managers and sales agents', grad: 'linear-gradient(135deg,#4f46e5,#3730a3)' },
          { role: 'client', icon: <IconBuilding />,  title: 'Client Portal',  sub: 'Place and track your orders',              grad: 'linear-gradient(135deg,#7c3aed,#4f46e5)' },
        ].map(({ role, icon, title, sub, grad }) => (
          <button
            key={role}
            onClick={() => onSelect(role)}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1rem 1.1rem',
              border: '1.5px solid #e5e7eb', borderRadius: '14px',
              background: '#fff', cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.18s', width: '100%',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.background = '#f5f3ff'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(79,70,229,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#fff'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <div style={{ width: 44, height: 44, borderRadius: '12px', flexShrink: 0, background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              {icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#111827' }}>{title}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>{sub}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        ))}
      </div>

      <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.82rem', color: '#9ca3af' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.82rem', padding: 0, textDecoration: 'underline' }}>
          ← Back to home
        </button>
      </p>
    </div>
  );
}

// ── Shared form label ─────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {children}
    </label>
  );
}

// ── Admin login form ──────────────────────────────────────────────────────────
function AdminLoginForm({ onBack }) {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required'); return; }
    const result = await login(email, password);
    if (result.success) navigate('/dashboard');
    else setError(result.error || 'Incorrect email or password');
  };

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'linear-gradient(135deg,#4f46e5,#3730a3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: '1rem', boxShadow: '0 8px 20px rgba(79,70,229,0.3)' }}>
          <IconShield />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#111827', margin: '0 0 0.4rem', letterSpacing: '-0.02em' }}>Admin / Staff</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>Enter your credentials to access the dashboard</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', color: '#991b1b', fontSize: '0.875rem' }}>
            ⚠ {error}
          </div>
        )}
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="firstname@domain.com" disabled={isLoading} autoComplete="email" />
        </div>
        <div>
          <Label>Password</Label>
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Your password" disabled={isLoading} autoComplete="current-password"
            rightSlot={
              <button type="button" onClick={() => setShowPassword(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
                <EyeIcon open={showPassword} />
              </button>
            }
          />
        </div>
        <button
          type="submit" disabled={isLoading}
          style={{ width: '100%', padding: '0.85rem', background: isLoading ? '#a5b4fc' : 'linear-gradient(135deg,#4f46e5,#3730a3)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(79,70,229,0.35)', marginTop: '0.25rem', transition: 'transform 0.15s, filter 0.15s' }}
          onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.06)'; }}}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; }}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

// ── Client login form ─────────────────────────────────────────────────────────
function ClientLoginForm({ onBack }) {
  const navigate = useNavigate();
  const { login, isLoading } = useClientAuthStore();
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required'); return; }
    const result = await login(email, password);
    if (result.success) navigate('/client/portal');
    else setError(result.error || 'Invalid email or password');
  };

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Back
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: '14px', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: '1rem', boxShadow: '0 8px 20px rgba(124,58,237,0.3)' }}>
          <IconBuilding />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#111827', margin: '0 0 0.4rem', letterSpacing: '-0.02em' }}>Client Portal</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>Sign in to place and track your orders</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', color: '#991b1b', fontSize: '0.875rem' }}>
            ⚠ {error}
          </div>
        )}
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@company.com" disabled={isLoading} autoComplete="email" />
        </div>
        <div>
          <Label>Password</Label>
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Your password" disabled={isLoading} autoComplete="current-password"
            rightSlot={
              <button type="button" onClick={() => setShowPassword(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, display: 'flex' }}>
                <EyeIcon open={showPassword} />
              </button>
            }
          />
        </div>
        <button
          type="submit" disabled={isLoading}
          style={{ width: '100%', padding: '0.85rem', background: isLoading ? '#c4b5fd' : 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, cursor: isLoading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(124,58,237,0.35)', marginTop: '0.25rem', transition: 'transform 0.15s, filter 0.15s' }}
          onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.filter = 'brightness(1.06)'; }}}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.filter = 'none'; }}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: '#9ca3af' }}>
        Don't have access? Contact your sales representative.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Login() {
  const location = useLocation();
  const initialView = location.state?.role === 'client' ? 'client' : 'select';
  const [view, setView] = useState(initialView);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Left — white form side */}
      <div style={{
        width: '100%', maxWidth: 560,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: 'clamp(2rem,5vw,3.5rem)',
        background: '#fff',
      }}>
        {view === 'select' && <RoleSelector onSelect={setView} />}
        {view === 'admin'  && <AdminLoginForm  onBack={() => setView('select')} />}
        {view === 'client' && <ClientLoginForm onBack={() => setView('select')} />}
      </div>

      {/* Right — branded panel, hidden on mobile */}
      <div style={{ flex: 1, display: 'flex' }} className="lbp">
        <BrandPanel role={view === 'client' ? 'client' : 'admin'} />
      </div>

      <style>{`
        @media (max-width: 768px) { .lbp { display: none !important; } }
        *, *::before, *::after { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
