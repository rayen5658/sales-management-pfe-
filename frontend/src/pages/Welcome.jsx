import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LuArrowRight, LuShieldCheck, LuShoppingBag, LuUsers, LuChartBar, LuZap } from 'react-icons/lu';
import AppLogo from '../components/common/AppLogo';
import DarkModeToggle from '../components/common/DarkModeToggle';
import PulseWave from '../components/common/PulseWave';
import './Welcome.css';

// Animates a number smoothly toward `target` whenever it changes (ease-out).
function useAnimatedNumber(target, duration = 1200) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return value;
}

// A few snapshots the mock preview cycles through, so it reads as "live" data
// rather than a static screenshot.
const KPI_TICKS = [
  { revenue: 3.5, orders: 31, clients: 16, products: 19, bars: [14, 24, 18, 36, 28, 42, 33], change: 18 },
  { revenue: 3.8, orders: 34, clients: 17, products: 21, bars: [22, 18, 30, 40, 24, 36, 45], change: 24 },
  { revenue: 3.6, orders: 29, clients: 18, products: 20, bars: [18, 32, 26, 20, 38, 30, 27], change: 15 },
  { revenue: 4.1, orders: 37, clients: 18, products: 22, bars: [26, 20, 34, 30, 44, 38, 41], change: 29 },
];

// A card that tilts in real 3D space toward the cursor, with a soft light
// glare that follows the pointer — same technique as the mock dashboard below,
// applied to the feature cards for a cohesive "everything here has depth" feel.
function Tilt3DCard({ children, className }) {
  const ref = useRef(null);
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateY(-4px) scale3d(1.02,1.02,1.02)`;
    setGlare({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100, opacity: 1 });
  };
  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = '';
    setGlare(g => ({ ...g, opacity: 0 }));
  };

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative', transformStyle: 'preserve-3d', transition: 'transform 0.15s ease-out, box-shadow 0.15s', willChange: 'transform' }}
    >
      {children}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.4), transparent 55%)`,
        opacity: glare.opacity * 0.5, transition: 'opacity 0.25s ease',
        mixBlendMode: 'overlay',
      }} />
    </div>
  );
}

function LiveMockDashboard() {
  const [tickIndex, setTickIndex] = useState(0);
  const mockRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTickIndex(i => (i + 1) % KPI_TICKS.length), 3800);
    return () => clearInterval(id);
  }, []);

  const tick = KPI_TICKS[tickIndex];
  const revenue  = useAnimatedNumber(tick.revenue, 1100);
  const orders   = useAnimatedNumber(tick.orders, 1100);
  const clients  = useAnimatedNumber(tick.clients, 1100);
  const products = useAnimatedNumber(tick.products, 1100);
  const change   = useAnimatedNumber(tick.change, 1100);

  const kpis = [
    { t: 'Revenue',  v: `${revenue.toFixed(1)}M TND`, c: '#0d9488' },
    { t: 'Orders',   v: Math.round(orders),            c: '#10b981' },
    { t: 'Clients',  v: Math.round(clients),           c: '#f59e0b' },
    { t: 'Products', v: Math.round(products),          c: '#ef4444' },
  ];

  // Mouse-tracked 3D tilt — the card leans toward the cursor for a subtle
  // depth effect, and eases back flat when the mouse leaves.
  const handleMouseMove = (e) => {
    const el = mockRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1000px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale3d(1.015,1.015,1.015)`;
  };
  const handleMouseLeave = () => {
    if (mockRef.current) mockRef.current.style.transform = '';
  };

  return (
    <div className="mock-3d-wrap" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      <div className="mock" ref={mockRef}>
        <div className="mock-top">
          <div className="dots"><span /><span /><span /></div>
          <div className="mock-title">
            <span className="live-dot" aria-hidden="true" />
            Live &bull; Dashboard
          </div>
          <PulseWave bars={6} height={18} color="#0d9488" color2="#0891b2" speed={1400} barWidth={3} gap={2} />
        </div>
        <div className="mock-body">
          <div className="mock-kpis">
            {kpis.map(x => (
              <div key={x.t} className="mock-kpi">
                <div className="mock-kpi-label">{x.t}</div>
                <div className="mock-kpi-value" style={{ color: x.c }}>{x.v}</div>
                <div className="mock-kpi-bar" style={{ background: x.c }} />
              </div>
            ))}
          </div>
          <div className="mock-chart">
            <div className="chart-left">
              <div className="chart-badge">Sales by period</div>
              <div className="chart-big">+{change.toFixed(0)}%</div>
              <div className="chart-sub">vs previous period</div>
            </div>
            <div className="chart-right">
              <div className="bars">
                {tick.bars.map((h, i) => (
                  <div key={i} className="bar" style={{
                    height: `${h * 3}px`,
                    background: ['#0d9488', '#10b981', '#f59e0b', '#ef4444'][i % 4],
                  }} />
                ))}
              </div>
              <div className="chart-gridlines" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="welcome-root">
      <div className="welcome-bg" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="grid" />
      </div>

      {/* ── Header ── */}
      <header className="welcome-header">
        <div className="welcome-brand">
          <AppLogo size={34} showText={true} />
        </div>

        <div className="welcome-actions">
          <DarkModeToggle size={36} />
          <button className="btn-primary" onClick={() => navigate('/login')}>
            Sign In
            <LuArrowRight size={16} />
          </button>
        </div>
      </header>

      <main className="welcome-main">

        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero-copy">
            <div className="pill animate-fade-in-up delay-1">
              <LuZap size={14} />
              <span>Sales management, reimagined</span>
            </div>
            <h1 className="animate-fade-in-up delay-2">
              Transform your sales into
              <span className="gradient-text"> decisions</span> in real time.
            </h1>
            <p className="animate-fade-in-up delay-3">
              Real-time KPIs, order tracking, client portal and role-based access —
              everything your team needs in one place.
            </p>

            <div className="hero-ctas animate-fade-in-up delay-4">
              <button className="btn-primary btn-cta" onClick={() => navigate('/login')}>
                Sign In
                <LuArrowRight size={18} />
              </button>
            </div>

            {/* Single access card pointing to login */}
            <div className="access-row animate-fade-in-up delay-5">
              <div
                className="access-card"
                onClick={() => navigate('/login')}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate('/login')}
                title="Administrators, managers, sales agents and clients"
              >
                <div className="access-icon">🔐</div>
                <div>
                  <div className="access-title">Sign in to your account</div>
                  <div className="access-sub">Admin, Manager, Sales Agent or Client</div>
                </div>
                <LuArrowRight size={14} className="access-arrow" />
              </div>
            </div>
          </div>

          {/* Live-feeling mock dashboard preview */}
          <div className="hero-visual" aria-hidden="true">
            <LiveMockDashboard />
          </div>
        </section>

        {/* ── Features ── */}
        <section className="features">
          <div className="section-head">
            <h2>Everything you need — in one app</h2>
            <p>Built for sales teams and their clients.</p>
          </div>
          <div className="feature-grid">
            {[
              { icon: <LuChartBar size={20} />, title: 'KPIs & Analytics',       text: 'Revenue, trends, top products and regional sales on one dashboard.' },
              { icon: <LuShoppingBag size={20} />, title: 'Order Management',     text: 'Create, track and manage orders with full status history.' },
              { icon: <LuUsers size={20} />, title: 'Client Portal',              text: 'Clients can log in, browse products and place orders directly.' },
              { icon: <LuShieldCheck size={20} />, title: 'Role-based Security',       text: 'Administrator, Manager and Sales Agent — each with the right access.' },
            ].map(f => (
              <Tilt3DCard key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-text">{f.text}</div>
              </Tilt3DCard>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="final-cta">
          <div className="final-card">
            <div className="final-left">
              <div className="pill pill-strong">
                <LuZap size={14} />
                <span>Ready to start?</span>
              </div>
              <h3>Sign in and explore all features</h3>
              <p>Choose your access type and you're in within seconds.</p>
            </div>
            <div className="final-right">
              <button className="btn-primary btn-cta" onClick={() => navigate('/login')}>
                Sign In
                <LuArrowRight size={18} />
              </button>
              <Link className="link-muted" to="/login">Access the dashboard →</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <span>&copy; {new Date().getFullYear()} Sales Management</span>
        <span className="sep">&bull;</span>
        <span>Sales Management System</span>
      </footer>
    </div>
  );
}
