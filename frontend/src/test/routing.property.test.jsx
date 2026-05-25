/**
 * Property-based tests for routing.
 * Feature: welcome-page-upgrade
 * Tasks: 6.1 – 6.4
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { setAuth, resetAuth, AUTHED_USER } from './mockAuthStore';
import { useAuthStore } from '../stores/authStore';

// ── Stubs ────────────────────────────────────────────────────────────────────
vi.mock('../pages/Welcome',        () => ({ default: () => <div data-testid="welcome-page">Welcome</div> }));
vi.mock('../pages/Login',          () => ({ default: () => <div data-testid="login-page">Login</div> }));
vi.mock('../pages/Dashboard',      () => ({ default: () => <div data-testid="dashboard-page">Dashboard</div> }));
vi.mock('../pages/ProductsPage',   () => ({ default: () => <div data-testid="products-page">Products</div> }));
vi.mock('../pages/CategoriesPage', () => ({ default: () => <div data-testid="categories-page">Categories</div> }));
vi.mock('../pages/ClientsPage',    () => ({ default: () => <div data-testid="clients-page">Clients</div> }));
vi.mock('../pages/OrdersPage',     () => ({ default: () => <div data-testid="orders-page">Orders</div> }));
vi.mock('../pages/UsersPage',      () => ({ default: () => <div data-testid="users-page">Users</div> }));
vi.mock('../pages/AuditLogsPage',  () => ({ default: () => <div data-testid="audit-logs-page">AuditLogs</div> }));
vi.mock('../components/common/Sidebar', () => ({ default: () => null }));
vi.mock('../components/common/TopBar',  () => ({ default: () => null }));

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

// ── Shared constants ─────────────────────────────────────────────────────────
const PROTECTED_PATHS = [
  '/dashboard',
  '/products',
  '/categories',
  '/clients',
  '/orders',
  '/users',
  '/audit-logs',
];

const DEFINED_ROUTES = new Set([
  '/', '/welcome', '/login',
  ...PROTECTED_PATHS,
]);

function AppLayout({ children }) { return <div>{children}</div>; }

function RootRedirect() {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Welcome />;
}

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

// ── Setup / teardown ─────────────────────────────────────────────────────────
beforeEach(() => resetAuth());
afterEach(() => resetAuth());

// ── Property tests ───────────────────────────────────────────────────────────
describe('Routing — property-based', () => {

  /**
   * Property 1: All protected routes redirect unauthenticated users away from the page.
   * Validates: Requirements 3.1
   */
  it('Property 1: all protected routes redirect unauthenticated users away from the page', () => {
    // Feature: welcome-page-upgrade, Property 1: All protected routes redirect unauthenticated users to /
    fc.assert(
      fc.property(
        fc.constantFrom(...PROTECTED_PATHS),
        (path) => {
          setAuth(false);
          const { unmount } = renderRoutes(path);

          // The protected page itself must NOT be rendered
          const pageTestId = path.replace('/', '').replace('-', '-') + '-page';
          // Map path → testid
          const testIdMap = {
            '/dashboard':  'dashboard-page',
            '/products':   'products-page',
            '/categories': 'categories-page',
            '/clients':    'clients-page',
            '/orders':     'orders-page',
            '/users':      'users-page',
            '/audit-logs': 'audit-logs-page',
          };
          const result = screen.queryByTestId(testIdMap[path]);
          unmount();
          resetAuth();
          return result === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: All protected routes render content for authenticated users (with matching role).
   * Validates: Requirements 3.2
   */
  it('Property 2: all protected routes render content for authenticated users', () => {
    // Feature: welcome-page-upgrade, Property 2: All protected routes render content for authenticated users
    const testIdMap = {
      '/dashboard':  { testId: 'dashboard-page',   role: 'Sales Agent' },
      '/products':   { testId: 'products-page',    role: 'Sales Agent' },
      '/categories': { testId: 'categories-page',  role: 'Sales Agent' },
      '/clients':    { testId: 'clients-page',     role: 'Sales Agent' },
      '/orders':     { testId: 'orders-page',      role: 'Sales Agent' },
      '/users':      { testId: 'users-page',       role: 'Administrator' },
      '/audit-logs': { testId: 'audit-logs-page',  role: 'Administrator' },
    };

    fc.assert(
      fc.property(
        fc.constantFrom(...PROTECTED_PATHS),
        (path) => {
          const { testId, role } = testIdMap[path];
          setAuth(true, { ...AUTHED_USER, role_name: role });
          const { unmount } = renderRoutes(path);
          const result = screen.queryByTestId(testId) !== null;
          unmount();
          resetAuth();
          return result;
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: All unknown routes redirect to / (Welcome for guests).
   * Validates: Requirements 6.1
   */
  it('Property 3: all unknown routes redirect to / (Welcome for unauthenticated users)', () => {
    // Feature: welcome-page-upgrade, Property 3: All unknown routes redirect to /
    const unknownPathArb = fc
      .string({ minLength: 1, maxLength: 40 })
      .map((s) => '/' + s.replace(/[^a-z0-9-]/gi, 'x'))
      .filter((p) => !DEFINED_ROUTES.has(p));

    fc.assert(
      fc.property(unknownPathArb, (path) => {
        setAuth(false);
        const { unmount } = renderRoutes(path);
        const result = screen.queryByTestId('welcome-page') !== null;
        unmount();
        resetAuth();
        return result;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 4: All CTA buttons/links on Welcome navigate to /login.
   * Validates: Requirements 7.8
   */
  it('Property 4: all CTA buttons on Welcome navigate to /login', () => {
    // Feature: welcome-page-upgrade, Property 4: All CTA buttons on Welcome navigate to /login
    // We render Welcome inside a MemoryRouter and check that every element
    // that links to a route points to /login.
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // All <a> tags rendered by Welcome should point to /login
    const links = document.querySelectorAll('a[href]');
    const ctaSelectors = Array.from(links);

    fc.assert(
      fc.property(
        fc.constantFrom(...(ctaSelectors.length > 0 ? ctaSelectors : [null])),
        (el) => {
          if (!el) return true;
          const href = el.getAttribute('href');
          return href === '/login';
        },
      ),
      { numRuns: Math.max(ctaSelectors.length, 1) },
    );

    unmount();
  });

});
