import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardService, userService, orderService } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import jsPDF from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

// Apply autoTable plugin to jsPDF
applyPlugin(jsPDF);
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ReferenceLine, Legend,
} from 'recharts';
import { LuTrendingUp, LuShoppingCart, LuUsers, LuPackage } from 'react-icons/lu';
import TunisiaMap from '../components/dashboard/TunisiaMap';
import ErrorBoundary from '../components/common/ErrorBoundary';
import '../styles/pages.css';
import './Dashboard.css';
import Tilt3DCard from '../components/common/Tilt3DCard';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';

// Animated progress bar — fills only when scrolled into view
function AnimatedBar({ pct, color }) {
  const [width, setWidth] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    setWidth(0);
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setWidth(pct); },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [pct]);
  return (
    <div ref={ref} className="progress-bar">
      <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color, transition: 'width 0.85s cubic-bezier(0.22,1,0.36,1)' }} />
    </div>
  );
}

// KPI card — 3D tilt + animated counter
function KpiCard({ label, rawValue, sub, subColor, Icon, bg, border, iconBg, shadow, color, index }) {
  const animated = useAnimatedNumber(typeof rawValue === 'number' ? rawValue : 0, 850);
  const isRev = label.toLowerCase().includes('revenue');
  const display = isRev
    ? new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0 }).format(Math.round(animated)) + ' TND'
    : Math.round(animated).toLocaleString();
  return (
    <Tilt3DCard
      className="kpi-card"
      style={{ background: bg, borderColor: border, animation: 'cardEntrance 0.5s cubic-bezier(0.22,1,0.36,1) both', animationDelay: `${index * 0.07}s` }}
      intensity={10}
    >
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 8px 20px ${shadow}`, color: '#fff' }}>
        <Icon size={26} strokeWidth={2} />
      </div>
      <div>
        <p className="kpi-label">{label}</p>
        <p className="kpi-value" data-chatbot={label.toLowerCase().replace(/\s+/g, '-')} style={{ color, fontSize: '1.5rem' }}>{display}</p>
        {sub && <p className="kpi-sub" style={{ color: subColor, fontWeight: subColor ? 600 : undefined }}>{sub}</p>}
      </div>
    </Tilt3DCard>
  );
}

// Export top products to PDF
function exportTopProductsPDF(topProds, period) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('Report — Top Products', 14, 12);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${period} | Generated on ${new Date().toLocaleDateString('en-GB')}`, 14, 21);

  doc.autoTable({
    startY: 35,
    head: [['#', 'Product', 'Qty Sold', 'Revenue (TND)']],
    body: topProds.map((p, i) => [
      i + 1,
      p.name,
      p.qty,
      new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 2 }).format(parseFloat(p.revenue || 0)),
    ]),
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 2: { halign: 'center' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  doc.save(`top-products-${period}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Export top products to CSV/Excel
function exportTopProductsCSV(topProds, period) {
  const headers = ['Rank', 'Product', 'Qty Sold', 'Revenue (TND)'];
  const rows = topProds.map((p, i) => [
    i + 1,
    `"${p.name.replace(/"/g, '""')}"`,
    p.qty,
    parseFloat(p.revenue || 0).toFixed(2),
  ]);
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `top-products-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const fmt = (v) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0 }).format(Math.round(v || 0)) + ' TND';

const PERIODS = [
  { value: 'week',    label: 'This week' },
  { value: 'month',   label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year',    label: 'This year' },
  { value: 'all',     label: 'All' },
];

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

// Custom tooltip for revenue chart
const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: '0.8rem', minWidth: 160 }}>
      <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: '0.4rem' }}>{label}</p>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.2rem' }}>
          <span style={{ color: entry.color, fontWeight: 600 }}>
            {entry.name === 'revenue' ? '● This year' : '● Prev. year'}
          </span>
          <span style={{ fontWeight: 700, color: '#1e293b' }}>
            {new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0 }).format(Math.round(entry.value || 0))} TND
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdminOrManager = user?.role_name === 'Administrator' || user?.role_name === 'Manager';
  const [period, setPeriod]       = useState('year');
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'area'
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [users, setUsers]         = useState([]);
  const [regions, setRegions]     = useState([]);
  const [stats, setStats]         = useState(null);
  const [regionData, setRegionData] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const load = useCallback(async (p, uid, reg, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError('');
    try {
      const [s, r] = await Promise.all([
        dashboardService.getStats(p, uid, reg),
        dashboardService.getByRegion(),
      ]);
      setStats(s.data);
      setRegionData(r.data);
    } catch (err) {
      setLoadError(err.response?.data?.error || 'Error loading dashboard');
    }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Only admins and managers can filter by sales rep — Sales Agents don't need this list
    if (isAdminOrManager) {
      userService.getAll().then(r => {
        setUsers(r.data);
      }).catch(() => {});
    }
    dashboardService.getByRegion().then(r => {
      setRegions(r.data.map(x => x.region));
    }).catch(() => {});
    if (isAdminOrManager) {
      setPendingLoading(true);
      orderService.getPendingAdmin()
        .then(r => setPendingOrders(r.data))
        .catch(() => {})
        .finally(() => setPendingLoading(false));
    }
  }, [isAdminOrManager]);

  useEffect(() => { load(period, selectedUser, selectedRegion); }, [period, selectedUser, selectedRegion, load]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div className="spinner-lg" />
      <p style={{ color: 'var(--text-muted)' }}>Loading dashboard...</p>
    </div>
  );

  if (loadError) return (
    <div className="page">
      <div className="alert alert-error">⚠ {loadError}</div>
      <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => load(period, selectedUser, selectedRegion)}>
        Retry
      </button>
    </div>
  );

  const kpis       = stats?.kpis || {};
  const monthly    = stats?.monthlyRevenue || [];
  const topProds   = stats?.topProducts || [];
  const topClients = stats?.topClients || [];

  const variation     = kpis.variation;
  const variationNum  = parseFloat(variation);
  const variationColor = variationNum > 0 ? '#10b981' : variationNum < 0 ? '#ef4444' : '#64748b';
  const variationIcon  = variationNum > 0 ? '↑' : variationNum < 0 ? '↓' : '→';

  return (
    <div className="page">

      {/* ── Floating ambient orbs ── */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,0.055) 0%, transparent 70%)', top: '-200px', right: '-150px', animation: 'floaty 14s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(8,145,178,0.045) 0%, transparent 70%)', bottom: '-100px', left: '8%', animation: 'floaty 18s ease-in-out infinite', animationDelay: '3s' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.035) 0%, transparent 70%)', top: '40%', left: '-80px', animation: 'floaty 22s ease-in-out infinite', animationDelay: '7s' }} />
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button key={p.value} className={`period-tab ${period === p.value ? 'active' : ''}`} onClick={() => setPeriod(p.value)}>
            {p.label}
          </button>
        ))}
        {users.length > 0 && (
          <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', background: '#fff' }}>
            <option value="">All sales reps</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.firstname} {u.lastname}</option>)}
          </select>
        )}
        {regions.length > 0 && (
          <select value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem', background: '#fff' }}>
            <option value="">All regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <button className="btn btn-ghost" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
          onClick={() => load(period, selectedUser, selectedRegion, true)}>
          {refreshing ? '⟳' : '↺'} Refresh
        </button>
      </div>

      {/* ── Section title ── */}
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Sales Summary</h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
          {PERIODS.find(p => p.value === period)?.label} — real-time data
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="kpi-grid">
        {[
          { label: "Revenue",        value: fmt(kpis.totalRevenue), sub: variation !== null ? `${variationIcon} ${Math.abs(variationNum)}% vs prev. period` : '', subColor: variationColor, Icon: LuTrendingUp,    bg: 'linear-gradient(135deg,#fdf4ff,#fae8ff)', border: '#e9d5ff', iconBg: 'linear-gradient(135deg,#a855f7,#7c3aed)', shadow: 'rgba(168,85,247,0.35)', color: '#7c3aed' },
          { label: 'Orders',         value: kpis.totalOrders || 0, sub: `Avg basket: ${kpis.totalOrders > 0 ? fmt(kpis.totalRevenue / kpis.totalOrders) : '—'}`, Icon: LuShoppingCart, bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '#bfdbfe', iconBg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', shadow: 'rgba(59,130,246,0.35)', color: '#2563eb' },
          { label: 'Active Clients', value: kpis.activeClients || 0, sub: 'Active status in database', Icon: LuUsers,        bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#bbf7d0', iconBg: 'linear-gradient(135deg,#22c55e,#15803d)', shadow: 'rgba(34,197,94,0.35)', color: '#16a34a' },
          { label: 'Products',       value: kpis.totalProducts || 0, sub: kpis.lowStockProducts > 0 ? `${kpis.lowStockProducts} low stock` : 'Stock OK', subColor: kpis.lowStockProducts > 0 ? '#ef4444' : undefined, Icon: LuPackage, bg: 'linear-gradient(135deg,#fff7ed,#ffedd5)', border: '#fed7aa', iconBg: 'linear-gradient(135deg,#f97316,#c2410c)', shadow: 'rgba(249,115,22,0.35)', color: '#ea580c' },
        ].map((k, i) => (
          <KpiCard
            key={i}
            index={i}
            label={k.label}
            rawValue={typeof k.value === 'number' ? k.value : parseFloat(String(k.value).replace(/[^\d.]/g, '')) || 0}
            sub={k.sub}
            subColor={k.subColor}
            Icon={k.Icon}
            bg={k.bg}
            border={k.border}
            iconBg={k.iconBg}
            shadow={k.shadow}
            color={k.color}
          />
        ))}
      </div>

      {/* ── Pending Orders Alert (Admin/Manager only) ── */}
      {isAdminOrManager && (pendingLoading || pendingOrders.length > 0) && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            background: pendingOrders.length > 0 ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : '#f8fafc',
            border: `1.5px solid ${pendingOrders.length > 0 ? '#fcd34d' : '#e2e8f0'}`,
            borderRadius: '12px',
            padding: '1rem 1.25rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: pendingOrders.length > 0 ? '0.85rem' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.1rem' }}>⏳</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#92400e' }}>
                    Pending Orders
                    {pendingOrders.length > 0 && (
                      <span style={{ marginLeft: '0.5rem', background: '#f59e0b', color: '#fff', borderRadius: '999px', padding: '0.1rem 0.55rem', fontSize: '0.75rem' }}>
                        {pendingOrders.length}
                      </span>
                    )}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#b45309' }}>
                    {pendingLoading ? 'Loading...' : `${pendingOrders.length} order${pendingOrders.length !== 1 ? 's' : ''} awaiting confirmation`}
                  </p>
                </div>
              </div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', color: '#92400e', borderColor: '#fcd34d' }}
                onClick={() => navigate('/orders')}
              >
                View all orders →
              </button>
            </div>

            {!pendingLoading && pendingOrders.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #fcd34d' }}>
                      {['#', 'Client', 'Sales Rep', 'Date', 'Total (inc. tax)'].map(h => (
                        <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', color: '#92400e', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.slice(0, 5).map((o, i) => (
                      <tr key={o.id} style={{ borderBottom: i < Math.min(pendingOrders.length, 5) - 1 ? '1px solid #fef3c7' : 'none' }}>
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 700, color: '#92400e' }}>#{o.id}</td>
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600 }}>{o.client_name || '—'}</td>
                        <td style={{ padding: '0.45rem 0.6rem', color: '#78716c' }}>
                          {`${o.created_by_firstname || ''} ${o.created_by_lastname || ''}`.trim() || '—'}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem', color: '#78716c' }}>
                          {o.order_date ? new Date(o.order_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 700, color: '#d97706' }}>
                          {new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 2 }).format(parseFloat(o.amount_ttc || 0))} TND
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pendingOrders.length > 5 && (
                  <p style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.5rem', textAlign: 'center' }}>
                    +{pendingOrders.length - 5} more — <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/orders')}>view all</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Row 1: Revenue + Top products ── */}
      <div className="charts-grid">
        <div className="card chart-card" style={{ borderTop: '3px solid #6366f1' }}>
          <div className="chart-header">
            <h2>Monthly Revenue</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Chart type toggle */}
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px', gap: '2px' }}>
                {[{ key: 'bar', icon: '▊', label: 'Bar' }, { key: 'area', icon: '∿', label: 'Area' }].map(t => (
                  <button key={t.key} onClick={() => setChartType(t.key)}
                    style={{
                      padding: '0.2rem 0.6rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      background: chartType === t.key ? '#fff' : 'transparent',
                      color: chartType === t.key ? '#4f46e5' : '#94a3b8',
                      fontWeight: chartType === t.key ? 700 : 400,
                      fontSize: '0.75rem',
                      boxShadow: chartType === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >{t.icon} {t.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span className="legend-dot" style={{ background: '#4f46e5' }} /><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>This year</span>
                <span className="legend-dot" style={{ background: '#10b981' }} /><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prev. year</span>
              </div>
              <span className="chart-badge">Current year</span>
            </div>
          </div>

          {monthly.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p>No data</p></div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={260}>
                {chartType === 'bar' ? (
                  <BarChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={4} barCategoryGap="25%">
                    <defs>
                      <linearGradient id="barGradN" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                        <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="barGradP" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="#059669" stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'rgba(79,70,229,0.04)', radius: 6 }} />
                    <Bar dataKey="revenue_prev" name="revenue_prev" fill="url(#barGradP)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    <Bar dataKey="revenue" name="revenue" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {monthly.map((entry, index) => {
                        const isMax = entry.revenue === Math.max(...monthly.map(m => m.revenue || 0));
                        return <Cell key={index} fill={isMax ? '#4f46e5' : 'url(#barGradN)'} opacity={isMax ? 1 : 0.75} />;
                      })}
                    </Bar>
                  </BarChart>
                ) : (
                  <AreaChart data={monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gN" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} /><stop offset="95%" stopColor="#4f46e5" stopOpacity={0} /></linearGradient>
                      <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.15} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip content={<RevenueTooltip />} />
                    <Area type="monotone" dataKey="revenue_prev" name="revenue_prev" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#gP)" dot={false} />
                    <Area type="monotone" dataKey="revenue" name="revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#gN)" dot={{ fill: '#4f46e5', r: 3 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                )}
              </ResponsiveContainer>

              {/* Monthly summary row — best/worst/total */}
              {(() => {
                const validMonths = monthly.filter(m => m.revenue > 0);
                if (validMonths.length === 0) return null;
                const best  = validMonths.reduce((a, b) => a.revenue > b.revenue ? a : b);
                const worst = validMonths.reduce((a, b) => a.revenue < b.revenue ? a : b);
                const total = validMonths.reduce((s, m) => s + (m.revenue || 0), 0);
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginTop: '0.85rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem' }}>
                    {[
                      { label: 'Best month',   value: best.month,  sub: `${new Intl.NumberFormat('fr-TN',{minimumFractionDigits:0}).format(Math.round(best.revenue))} TND`, color: '#4f46e5', bg: '#f5f3ff' },
                      { label: 'Lowest month', value: worst.month, sub: `${new Intl.NumberFormat('fr-TN',{minimumFractionDigits:0}).format(Math.round(worst.revenue))} TND`, color: '#f59e0b', bg: '#fffbeb' },
                      { label: 'Total YTD',    value: `${new Intl.NumberFormat('fr-TN',{minimumFractionDigits:0}).format(Math.round(total))} TND`, sub: `${validMonths.length} months`, color: '#10b981', bg: '#f0fdf4' },
                    ].map((item, i) => (
                      <div key={i} style={{ background: item.bg, borderRadius: '8px', padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, marginBottom: '0.15rem' }}>{item.label}</p>
                        <p style={{ fontSize: '0.88rem', fontWeight: 800, color: item.color }}>{item.value}</p>
                        <p style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{item.sub}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </div>

        <div className="card chart-card" style={{ borderTop: '3px solid #f472b6' }}>
          <div className="chart-header">
            <h2>Top 5 Products</h2>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span className="chart-badge">By qty sold</span>
              {topProds.length > 0 && (
                <>
                  <button className="btn btn-ghost" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                    onClick={() => exportTopProductsPDF(topProds, PERIODS.find(p => p.value === period)?.label || period)}
                    title="Export as PDF">
                    📄 PDF
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem' }}
                    onClick={() => exportTopProductsCSV(topProds, period)}
                    title="Export as Excel/CSV">
                    📊 Excel
                  </button>
                </>
              )}
            </div>
          </div>
          {topProds.length === 0 ? <div className="empty-state" style={{ padding: '2rem' }}><p>No data</p></div> : (
            <div>
              {topProds.map((p, i) => {
                const max = parseFloat(topProds[0].qty);
                const pct = Math.round((parseFloat(p.qty) / max) * 100);
                const colors = ['#6366f1','#f472b6','#fb923c','#22c55e','#3b82f6'];
                return (
                  <div key={i} className="stat-row">
                    <div className="rank-badge" style={{ background: colors[i] + '20', color: colors[i] }}>{i+1}</div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, flex: 1, marginLeft: '0.6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <AnimatedBar pct={pct} color={colors[i]} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: colors[i], minWidth: '40px', textAlign: 'right' }}>{p.qty}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Top clients + KPI summary ── */}
      <div className="charts-grid" style={{ marginTop: '1rem' }}>
        <div className="card chart-card">
          <div className="chart-header">
            <h2>Top Clients</h2>
            <span className="chart-badge" style={{ cursor: 'pointer' }} onClick={() => navigate('/clients')}>→ View all</span>
          </div>
          {topClients.length === 0 ? <div className="empty-state" style={{ padding: '2rem' }}><p>No data</p></div> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topClients} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip formatter={(v) => [fmt(v), 'Revenue (inc. tax)']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem' }} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {topClients.map((c, i) => {
                  const months = parseInt(c.inactive_months || 0);
                  const isInactive = months >= 2;
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '0.2rem 0' }}>
                      <span style={{ color: 'var(--text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <span style={{ background: isInactive ? '#fee2e2' : '#dcfce7', color: isInactive ? '#991b1b' : '#166534', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 600, fontSize: '0.72rem' }}>
                        {isInactive ? `⚠ Inactive ${months}mo` : '✅ Active'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="card chart-card">
          <div className="chart-header">
            <h2>Period Summary</h2>
            <span className="chart-badge">{PERIODS.find(p => p.value === period)?.label}</span>
          </div>
          <div>
            {[
              { label: 'Total Revenue (inc. tax)', value: fmt(kpis.totalRevenue), color: '#4f46e5', icon: '💰' },
              { label: 'Prev. period revenue',    value: fmt(kpis.prevRevenue),   color: '#10b981', icon: '📅' },
              { label: 'Variation',               value: variation !== null ? `${variationIcon} ${Math.abs(variationNum)}%` : '—', color: variationColor, icon: '📈' },
              { label: 'Projection',              value: kpis.projection ? fmt(kpis.projection) : '—', color: '#8b5cf6', icon: '🔮' },
              { label: 'Orders',                  value: kpis.totalOrders || 0, color: '#3b82f6', icon: '🛒' },
              { label: 'Avg basket',              value: kpis.totalOrders > 0 ? fmt(kpis.totalRevenue / kpis.totalOrders) : '—', color: '#f59e0b', icon: '🧺' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', borderBottom: i < 5 ? '1px solid #f1f5f9' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span>{item.icon}</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{item.label}</span>
                </div>
                <strong style={{ fontSize: '0.9rem', color: item.color }}>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Interactive map + region table ── */}
      <div style={{ marginTop: '1rem' }}>
        <div className="card chart-card">
          <div className="chart-header">
            <h2>Sales by Region</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span className="chart-badge">Interactive map — click a region to filter</span>
              {selectedRegion && (
                <button
                  className="btn btn-ghost"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}
                  onClick={() => setSelectedRegion('')}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>
          {regionData.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}><p>No data</p></div>
          ) : (
            <div className="region-grid">
              {/* Interactive Tunisia map */}
              <ErrorBoundary fallback={
                <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  ⚠ The map could not load.
                </div>
              }>
                <TunisiaMap
                  regionData={regionData}
                  selectedRegion={selectedRegion}
                  onRegionClick={(region) => setSelectedRegion(region)}
                />
              </ErrorBoundary>

              {/* Region stats table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                      {['Region', 'Revenue (inc. tax)', 'Orders', 'Avg basket'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Région' ? 'left' : 'right', padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regionData.map((r, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: '1px solid #f8fafc',
                          cursor: 'pointer',
                          background: selectedRegion === r.region ? '#ede9fe' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                        onClick={() => setSelectedRegion(selectedRegion === r.region ? '' : r.region)}
                      >
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: selectedRegion === r.region ? '#4f46e5' : COLORS[i % COLORS.length] }} />
                            {r.region}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: '#4f46e5', fontWeight: 600 }}>{fmt(r.revenue)}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>{r.orders}</td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(r.avg_order)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
