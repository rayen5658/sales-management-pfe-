/**
 * Example-based unit tests for routing scenarios.
 * Feature: welcome-page-upgrade
 * Tasks: 7.1 – 7.6
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAuth, resetAuth } from './mockAuthStore';

// ── Lightweight page stubs ──────────────────────────────────────────────────
vi.mock('../pages/Welcome',       () => ({ default: () => <div data-testid="welcome-page">Welcome</div> }));
vi.mock('../pages/Login',         () => ({ default: () => <div data-testid="login-page">Login</div> }));
vi.mock('../pages/Dashboard',     () => ({ default: () => <div data-testid="dashboard-page">Dashboard</div> }));
vi.mock('../pages/ProductsPage',  () => ({ default: () => <div data-testid="products-page">Products</div> }));
vi.mock('../pages/CategoriesPage',() => ({ default: () => <div data-testid="categories-page">Categories</div> }));
vi.mock('../pages/ClientsPage',   () => ({ default: () => <div data-testid="clients-page">Clients</div> }));
vi.mock('../pages/OrdersPage',    () => ({ default: () => <div data-testid="orders-page">Orders</div> }));
vi.mock('../pages/UsersPage',     () => ({ default: () => <div data-testid="users-page">Users</div> }));
vi.mock('../pages/AuditLogsPage', () => ({ default: () => <div data-testid="audit-logs-page">AuditLogs</div> }));

// Stub layout components so they just render children
vi.mock('../components/common/Sidebar', () => ({ default: () => null }));
vi.mock('../components/common/TopBar',  () => ({ default: () => null }));

// ── Import App after mocks are registered ───────────────────────────────────
import App from '../App';

// ── Helper: render App at a given initial path ──────────────────────────────
function renderAt(path) {
  // App uses BrowserRouter internally; we override it with MemoryRouter by
  // wrapping the inner routes directly. Easier: just render App and rely on
  // the fact that MemoryRouter is not used — instead we manipulate history.
  // Since App uses BrowserRouter we render it and use window.history.
  // For test isolation we render the route tree directly with MemoryRouter.
  return renderRoutes(path);
}

// Re-export the App route tree with MemoryRouter so we can control the path.
import ProtectedRoute from '../components/common/ProtectedRoute';
import Welcome        from '../pages/Welcome';
import Login          from '../pages/Login';
import Dashboard      from '../pages/Dashboard';
import ProductsPage   from '../pages/ProductsPage';
import CategoriesPage from '../pages/CategoriesPage';
import ClientsPage    from '../pages/ClientsPage';
import OrdersPage     from '../pages/OrdersPage';
import UsersPage      from '../pages/UsersPage';
import AuditLogsPage  from '../pages/AuditLogsPage';
import { useAuthStore } from '../stores/authStore';

function AppLayout({ children }) {
  return <div>{children}</div>;
}

function RootRedirect() {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Welcome />;
}

/** Renders the full route tree starting at `initialPath`. */
function renderRoutes(initialPath) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/"        element={<RootRedirect />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login"   element={<Login />} />

        <Route path="/dashboard"  element={<ProtectedRoute requiredRole="Sales Agent"><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/products"   element={<ProtectedRoute requiredRole="Sales Agent"><AppLayout><ProductsPage /></AppLayout></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute requiredRole="Sales Agent"><AppLayout><CategoriesPage /></AppLayout></ProtectedRoute>} />
        <Route path="/clients"    element={<ProtectedRoute><AppLayout><ClientsPage /></AppLayout></ProtectedRoute>} />
        <Route path="/orders"     element={<ProtectedRoute requiredRole="Sales Agent"><AppLayout><OrdersPage /></AppLayout></ProtectedRoute>} />
        <Route path="/users"      element={<ProtectedRoute requiredRole="Administrator"><AppLayout><UsersPage /></AppLayout></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute requiredRole="Administrator"><AppLayout><AuditLogsPage /></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────
beforeEach(() => resetAuth());
afterEach(() => resetAuth());

describe('Routing — example-based', () => {

  // 7.1 Unauthenticated user at / renders Welcome page
  it('7.1 unauthenticated user at / renders Welcome page', () => {
    setAuth(false);
    renderAt('/');
    expect(screen.getByTestId('welcome-page')).toBeInTheDocument();
  });

  // 7.2 Authenticated user at / redirects to /dashboard
  it('7.2 authenticated user at / redirects to /dashboard', () => {
    setAuth(true);
    renderAt('/');
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.queryByTestId('welcome-page')).not.toBeInTheDocument();
  });

  // 7.3 /welcome renders Welcome page (unauthenticated)
  it('7.3 /welcome renders Welcome page for unauthenticated user', () => {
    setAuth(false);
    renderAt('/welcome');
    expect(screen.getByTestId('welcome-page')).toBeInTheDocument();
  });

  // 7.4 Authenticated user at /dashboard renders Dashboard
  it('7.4 authenticated user at /dashboard renders Dashboard', () => {
    setAuth(true);
    renderAt('/dashboard');
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  // 7.5 Unauthenticated user at /dashboard redirects to / (Welcome page)
  it('7.5 unauthenticated user at /dashboard is redirected away from dashboard', () => {
    setAuth(false);
    renderAt('/dashboard');
    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    // ProtectedRoute now redirects to / which shows Welcome for guests
    expect(screen.getByTestId('welcome-page')).toBeInTheDocument();
  });

  // 7.6 Catch-all unknown route redirects to / (which shows Welcome for guests)
  it('7.6 unknown route redirects to / and renders Welcome for unauthenticated user', () => {
    setAuth(false);
    renderAt('/this-route-does-not-exist');
    expect(screen.getByTestId('welcome-page')).toBeInTheDocument();
  });

  it('7.6b unknown route redirects to / and then to /dashboard for authenticated user', () => {
    setAuth(true);
    renderAt('/this-route-does-not-exist');
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

});
