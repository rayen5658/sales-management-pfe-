import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import ProtectedRoute from './components/common/ProtectedRoute';
import ClientProtectedRoute from './components/common/ClientProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import PageTransition from './components/common/PageTransition';
import Sidebar from './components/common/Sidebar';
import TopBar from './components/common/TopBar';
import ChatBot from './components/ChatBot';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import ClientsPage from './pages/ClientsPage';
import OrdersPage from './pages/OrdersPage';
import UsersPage from './pages/UsersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import PaymentSettingsPage from './pages/PaymentSettingsPage';
import ReturnsPage from './pages/ReturnsPage';
import FeedbackPage from './pages/FeedbackPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import ClientLogin from './pages/client/ClientLogin';
import ClientPortal from './pages/client/ClientPortal';
import ClientOrders from './pages/client/ClientOrders';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import './styles/index.css';

function AppLayout({ children }) {
  const location = useLocation();
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <TopBar />
        <main className="app-main">
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              {children}
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Root: unauthenticated → Welcome, authenticated → /dashboard
function RootRedirect() {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated
    ? <Navigate to="/dashboard" replace />
    : <Welcome />;
}

// Sets document.title for public pages that don't go through TopBar
const PUBLIC_TITLES = {
  '/':               'Dynamix Services',
  '/welcome':        'Welcome — Dynamix Services',
  '/login':          'Sign In — Dynamix Services',
  '/reset-password': 'Reset Password — Dynamix Services',
  '/client/login':   'Client Portal — Dynamix Services',
  '/client/portal':  'My Portal — Dynamix Services',
  '/client/orders':  'My Orders — Dynamix Services',
};

function PublicTitleSetter() {
  const location = useLocation();
  useEffect(() => {
    const title = PUBLIC_TITLES[location.pathname];
    if (title) document.title = title;
  }, [location.pathname]);
  return null;
}

export default function App() {
  const { initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();
  }, []);

  return (
    <ErrorBoundary fallback={
      <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h2>⚠ An unexpected error occurred</h2>
        <p>Open the console (F12) to see details, then reload the page.</p>
      </div>
    }>
      <BrowserRouter>
        <PublicTitleSetter />
        <ChatBot />
        <Routes>
          {/* Public routes */}
          <Route path="/"        element={<RootRedirect />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login"   element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route path="/dashboard"  element={<ProtectedRoute><AppLayout><ErrorBoundary><Dashboard /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/products"   element={<ProtectedRoute><AppLayout><ErrorBoundary><ProductsPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><AppLayout><ErrorBoundary><CategoriesPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/clients"    element={<ProtectedRoute><AppLayout><ErrorBoundary><ClientsPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/orders"     element={<ProtectedRoute><AppLayout><ErrorBoundary><OrdersPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/users"      element={<ProtectedRoute requiredRole="Administrator"><AppLayout><ErrorBoundary><UsersPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute requiredRole="Administrator"><AppLayout><ErrorBoundary><AuditLogsPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/payment-settings" element={<ProtectedRoute requiredRole="Administrator"><AppLayout><ErrorBoundary><PaymentSettingsPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/returns"    element={<ProtectedRoute requiredRole={['Administrator', 'Manager']}><AppLayout><ErrorBoundary><ReturnsPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/feedback"   element={<ProtectedRoute requiredRole={['Administrator', 'Manager']}><AppLayout><ErrorBoundary><FeedbackPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/suppliers"      element={<ProtectedRoute requiredRole={['Administrator', 'Manager']}><AppLayout><ErrorBoundary><SuppliersPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />
          <Route path="/purchase-orders" element={<ProtectedRoute requiredRole={['Administrator', 'Manager']}><AppLayout><ErrorBoundary><PurchaseOrdersPage /></ErrorBoundary></AppLayout></ProtectedRoute>} />

          {/* Client portal */}
          <Route path="/client/login"  element={<ClientLogin />} />
          <Route path="/client/portal" element={<ClientProtectedRoute><ClientPortal /></ClientProtectedRoute>} />
          <Route path="/client/orders" element={<ClientProtectedRoute><ClientOrders /></ClientProtectedRoute>} />

          {/* Catch-all → root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
