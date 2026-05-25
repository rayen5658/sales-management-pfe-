import axios from 'axios';

const clientApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach client token from localStorage on every request
clientApi.interceptors.request.use(config => {
  const token = localStorage.getItem('client_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }
  // Fallback: read from persisted zustand store
  try {
    const raw = localStorage.getItem('client-auth-store');
    const stored = raw ? JSON.parse(raw) : null;
    const zustandToken = stored?.state?.token;
    if (zustandToken) config.headers.Authorization = `Bearer ${zustandToken}`;
  } catch (_) {}
  return config;
});

clientApi.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('client_token');
      localStorage.removeItem('client-auth-store');
      window.location.href = '/client/login';
    }
    return Promise.reject(err);
  }
);

export const clientPortalService = {
  getMe:        ()             => clientApi.get('/client-portal/me'),
  getProducts:  (params)       => clientApi.get('/client-portal/products', { params }),
  getCategories:()             => clientApi.get('/client-portal/categories'),
  placeOrder:   (data)         => clientApi.post('/client-portal/orders', data),
  getOrders:    ()             => clientApi.get('/client-portal/orders'),
  getOrderById: (id)           => clientApi.get(`/client-portal/orders/${id}`),
};

// Admin-only: manage portal access (uses staff token from main api.js)
import api from './api';
export const clientPortalAdminService = {
  setPassword:    (client_id, password) => api.post('/client-portal/admin/set-password', { client_id, password }),
  disablePortal:  (client_id)           => api.post('/client-portal/admin/disable-portal', { client_id }),
};

export default clientApi;
