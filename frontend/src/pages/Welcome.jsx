import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LuArrowRight, LuShieldCheck, LuShoppingBag, LuUsers, LuChartBar, LuZap } from 'react-icons/lu';
import AppLogo from '../components/common/AppLogo';
import './Welcome.css';

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

          {/* Mock dashboard preview */}
          <div className="hero-visual" aria-hidden="true">
            <div className="mock">
              <div className="mock-top">
                <div className="dots"><span /><span /><span /></div>
                <div className="mock-title">Preview &bull; Dashboard</div>
              </div>
              <div className="mock-body">
                <div className="mock-kpis">
                  {[
                    { t: 'Revenue', v: '3.5M TND', c: '#4f46e5' },
                    { t: 'Orders',  v: '31',        c: '#10b981' },
                    { t: 'Clients', v: '16',        c: '#f59e0b' },
                    { t: 'Products',v: '19',        c: '#ef4444' },
                  ].map(x => (
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
                    <div className="chart-big">+18%</div>
                    <div className="chart-sub">vs previous period</div>
                  </div>
                  <div className="chart-right">
                    <div className="bars">
                      {[14, 24, 18, 36, 28, 42, 33].map((h, i) => (
                        <div key={i} className="bar" style={{
                          height: `${h * 3}px`,
                          background: ['#4f46e5','#10b981','#f59e0b','#ef4444'][i % 4],
                        }} />
                      ))}
                    </div>
                    <div className="chart-gridlines" />
                  </div>
                </div>
              </div>
            </div>
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
              <div key={f.title} className="feature-card">
                <div className="feature-icon">{f.icon}</div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-text">{f.text}</div>
              </div>
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
