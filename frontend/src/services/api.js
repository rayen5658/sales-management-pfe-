import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  // Prefer localStorage token (written on login), but fall back to Zustand persisted token.
  // This prevents 401 loops after refresh when auth-store is restored but auth_token is missing.
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }

  try {
    // auth-store persisted payload is stored under key "auth-store"
    const raw = localStorage.getItem('auth-store');
    const stored = raw ? JSON.parse(raw) : null;
    const zustandToken = stored?.state?.token;
    if (zustandToken) config.headers.Authorization = `Bearer ${zustandToken}`;
  } catch (_) {
    // ignore
  }

  return config;
});


api.interceptors.response.use(
  response => response,
  error => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes('/auth/')) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth-store');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export const authService = {
  login:          (email, password) => api.post('/auth/login', { email, password }),
  register:       (data)            => api.post('/auth/register', data),
  forgotPassword: (email)           => api.post('/auth/forgot-password', { email }),
  resetPassword:  (token, password) => api.post('/auth/reset-password', { token, password }),
};

export const clientAuthService = {
  register: (data) => api.post('/client-auth/register', data),
};

export const productService = {
  getAll:    (params) => api.get('/products', { params }),
  getById:   (id)     => api.get(`/products/${id}`),
  create:    (data)   => api.post('/products', data),
  update:    (id, d)  => api.put(`/products/${id}`, d),
  delete:    (id)     => api.delete(`/products/${id}`),
  importCSV: (file)   => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/products/import-csv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const variantService = {
  getByProduct: (productId)     => api.get(`/products/${productId}/variants`),
  create:       (productId, d)  => api.post(`/products/${productId}/variants`, d),
  update:       (id, d)         => api.put(`/variants/${id}`, d),
  delete:       (id)            => api.delete(`/variants/${id}`),
};

export const categoryService = {
  getAll:  (params) => api.get('/categories', { params }),
  getById: (id)     => api.get(`/categories/${id}`),
  create:  (data)   => api.post('/categories', data),
  update:  (id, d)  => api.put(`/categories/${id}`, d),
  delete:  (id)     => api.delete(`/categories/${id}`),
};

export const clientService = {
  getAll:    (params) => api.get('/clients', { params }),
  getById:   (id)     => api.get(`/clients/${id}`),
  getOrders: (id)     => api.get(`/clients/${id}/orders`),
  create:    (data)   => api.post('/clients', data),
  update:    (id, d)  => api.put(`/clients/${id}`, d),
  archive:   (id)     => api.put(`/clients/${id}/archive`),
  restore:   (id)     => api.put(`/clients/${id}/restore`),
  approve:   (id)     => api.put(`/clients/${id}/approve`),
  delete:    (id)     => api.delete(`/clients/${id}`),
};

export const orderService = {
  getAll:          (params)       => api.get('/orders', { params }),
  getById:         (id)           => api.get(`/orders/${id}`),
  getTracking:     (id)           => api.get(`/orders/${id}/tracking`),
  getPendingAdmin: ()             => api.get('/orders/pending/admin'),
  create:          (data)         => api.post('/orders', data),
  update:          (id, data)     => api.put(`/orders/${id}`, data),
  cancel:          (id, reason)   => api.put(`/orders/${id}/cancel`, { cancel_reason: reason }),
  updateStatus:    (id, status)   => api.put(`/orders/${id}/status`, { status }),
  ship:            (id, data)     => api.post(`/orders/${id}/ship`, data),
  markPaid:        (id, data)     => api.put(`/orders/${id}/mark-paid`, data),
};

export const userService = {
  getAll:         ()            => api.get('/users'),
  update:         (id, data)    => api.put(`/users/${id}`, data),
  toggleStatus:   (id, status)  => api.put(`/users/${id}/status`, { status }),
  resetPassword:  (id, pwd)     => api.put(`/users/${id}/reset-password`, { password: pwd }),
  delete:         (id)          => api.delete(`/users/${id}`),
  register:       (data)        => api.post('/auth/register', data),
};

export const roleService = {
  getAll: () => api.get('/roles'),
};

export const dashboardService = {
  getStats:     (period = 'year', user_id = '', region = '') => api.get('/dashboard/stats', { params: { period, ...(user_id && { user_id }), ...(region && { region }) } }),
  getByRegion:  () => api.get('/dashboard/region'),
  setGoal:      (monthly_target) => api.put('/dashboard/goal', { monthly_target }),
};

export const auditService = {
  getLogs: () => api.get('/audit-logs'),
};

export const notificationService = {
  get: () => api.get('/notifications'),
};

export const paymentSettingsService = {
  get:    ()     => api.get('/payment-settings'),
  update: (data) => api.put('/payment-settings', data),
};

export const supplierService = {
  getAll:  ()     => api.get('/suppliers'),
  getById: (id)   => api.get(`/suppliers/${id}`),
  create:  (data) => api.post('/suppliers', data),
  update:  (id, d)=> api.put(`/suppliers/${id}`, d),
  delete:  (id)   => api.delete(`/suppliers/${id}`),
};

export const purchaseOrderService = {
  getAll:       (params)     => api.get('/purchase-orders', { params }),
  getById:      (id)         => api.get(`/purchase-orders/${id}`),
  create:       (data)       => api.post('/purchase-orders', data),
  updateStatus: (id, status) => api.put(`/purchase-orders/${id}/status`, { status }),
  cancel:       (id, reason) => api.put(`/purchase-orders/${id}/cancel`, { cancel_reason: reason }),
  delete:       (id)         => api.delete(`/purchase-orders/${id}`),
};

export const returnService = {
  getAll:  ()             => api.get('/returns'),
  approve: (id, note)     => api.put(`/returns/${id}/approve`, { resolution_note: note }),
  reject:  (id, note)     => api.put(`/returns/${id}/reject`, { resolution_note: note }),
};

export const feedbackService = {
  getAll: () => api.get('/feedback'),
};

export default api;
