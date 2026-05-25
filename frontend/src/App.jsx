import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/common/ProtectedRoute';
import ClientProtectedRoute from './components/common/ClientProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import Sidebar from './components/common/Sidebar';
import TopBar from './components/common/TopBar';
import ChatBot from './components/ChatBot';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import Dashboard from './pages/Dashboard';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import ClientsPage from './pages/ClientsPage';
import OrdersPage from './pages/OrdersPage';
import UsersPage from './pages/UsersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import ClientLogin from './pages/client/ClientLogin';
import ClientPortal from './pages/client/ClientPortal';
import ClientOrders from './pages/client/ClientOrders';
import { useAuthStore } from './stores/authStore';
import './styles/index.css';

function AppLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar />
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: 'var(--bg)' }}>
          {children}
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

export default function App() {
  return (
    <ErrorBoundary fallback={
      <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h2>⚠ An unexpected error occurred</h2>
        <p>Open the console (F12) to see details, then reload the page.</p>
      </div>
    }>
      <BrowserRouter>
        <ChatBot />
        <Routes>
          {/* Public routes */}
          <Route path="/"        element={<RootRedirect />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login"   element={<Login />} />

          {/* Protected routes */}
          <Route path="/dashboard"  element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/products"   element={<ProtectedRoute><AppLayout><ProductsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/categories" element={<ProtectedRoute><AppLayout><CategoriesPage /></AppLayout></ProtectedRoute>} />
          <Route path="/clients"    element={<ProtectedRoute><AppLayout><ClientsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/orders"     element={<ProtectedRoute><AppLayout><OrdersPage /></AppLayout></ProtectedRoute>} />
          <Route path="/users"      element={<ProtectedRoute requiredRole="Administrator"><AppLayout><UsersPage /></AppLayout></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute requiredRole="Administrator"><AppLayout><AuditLogsPage /></AppLayout></ProtectedRoute>} />

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
