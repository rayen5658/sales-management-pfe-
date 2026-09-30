import { create } from 'zustand';
import {
  productService,
  clientService,
  orderService,
  categoryService,
} from '../services/api';

export const useDataStore = create((set) => ({
  // Products
  products: [],
  productsLoading: false,
  productsError: null,
  productsPagination: null, // { page, limit, total, totalPages, hasNext, hasPrev }

  // Clients
  clients: [],
  clientsLoading: false,
  clientsError: null,

  // Orders
  orders: [],
  ordersLoading: false,
  ordersError: null,
  ordersPagination: null, // { page, limit, total, totalPages, hasNext, hasPrev }

  // Categories
  categories: [],
  categoriesLoading: false,
  categoriesError: null,

  // ========== PRODUCTS ==========
  fetchProducts: async (params = {}) => {
    set({ productsLoading: true, productsError: null });
    try {
      const response = await productService.getAll(params);
      // Support both paginated ({ data, pagination }) and legacy flat array responses
      const payload = response.data;
      if (Array.isArray(payload)) {
        set({ products: payload, productsPagination: null, productsLoading: false });
        return payload;
      }
      set({ products: payload.data ?? [], productsPagination: payload.pagination, productsLoading: false });
      return payload.data ?? [];
    } catch (err) {
      const msg = err.response?.data?.message || 'Error loading products';
      set({ productsError: msg, productsLoading: false });
      throw err;
    }
  },

  createProduct: async (product) => {
    set({ productsLoading: true, productsError: null });
    try {
      const response = await productService.create(product);
      const newProduct = response.data;
      set(state => ({ products: [...state.products, newProduct], productsLoading: false }));
      return newProduct;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during creation';
      set({ productsError: msg, productsLoading: false });
      throw err;
    }
  },

  updateProduct: async (id, product) => {
    set({ productsLoading: true, productsError: null });
    try {
      const response = await productService.update(id, product);
      const updated = response.data;
      set(state => ({
        products: state.products.map(p => (p.id === id ? updated : p)),
        productsLoading: false,
      }));
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during update';
      set({ productsError: msg, productsLoading: false });
      throw err;
    }
  },

  deleteProduct: async (id) => {
    set({ productsLoading: true, productsError: null });
    try {
      await productService.delete(id);
      set(state => ({
        products: state.products.filter(p => p.id !== id),
        productsLoading: false,
      }));
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during deletion';
      set({ productsError: msg, productsLoading: false });
      throw err;
    }
  },

  // ========== CLIENTS ==========
  fetchClients: async (params = {}) => {
    set({ clientsLoading: true, clientsError: null });
    try {
      const response = await clientService.getAll(params);
      set({ clients: response.data, clientsLoading: false });
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error loading clients';
      set({ clientsError: msg, clientsLoading: false });
      throw err;
    }
  },

  createClient: async (client) => {
    set({ clientsLoading: true, clientsError: null });
    try {
      const response = await clientService.create(client);
      const newClient = response.data;
      set(state => ({ clients: [...state.clients, newClient], clientsLoading: false }));
      return newClient;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during creation';
      set({ clientsError: msg, clientsLoading: false });
      throw err;
    }
  },

  updateClient: async (id, client) => {
    set({ clientsLoading: true, clientsError: null });
    try {
      const response = await clientService.update(id, client);
      const updated = response.data;
      set(state => ({
        clients: state.clients.map(c => (c.id === id ? updated : c)),
        clientsLoading: false,
      }));
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during update';
      set({ clientsError: msg, clientsLoading: false });
      throw err;
    }
  },

  deleteClient: async (id) => {
    set({ clientsLoading: true, clientsError: null });
    try {
      await clientService.delete(id);
      set(state => ({
        clients: state.clients.filter(c => c.id !== id),
        clientsLoading: false,
      }));
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during deletion';
      set({ clientsError: msg, clientsLoading: false });
      throw err;
    }
  },

  archiveClient: async (id) => {
    set({ clientsLoading: true, clientsError: null });
    try {
      const response = await clientService.archive(id);
      const updated = response.data.client;
      set(state => ({
        clients: state.clients.map(c => (c.id === id ? updated : c)),
        clientsLoading: false,
      }));
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during archiving';
      set({ clientsError: msg, clientsLoading: false });
      throw err;
    }
  },

  restoreClient: async (id) => {
    set({ clientsLoading: true, clientsError: null });
    try {
      const response = await clientService.restore(id);
      const updated = response.data.client;
      set(state => ({
        clients: state.clients.map(c => (c.id === id ? updated : c)),
        clientsLoading: false,
      }));
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during restoration';
      set({ clientsError: msg, clientsLoading: false });
      throw err;
    }
  },

  approveClient: async (id) => {
    set({ clientsLoading: true, clientsError: null });
    try {
      const response = await clientService.approve(id);
      const updated = response.data.client;
      set(state => ({
        clients: state.clients.map(c => (c.id === id ? updated : c)),
        clientsLoading: false,
      }));
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during approval';
      set({ clientsError: msg, clientsLoading: false });
      throw err;
    }
  },

  // ========== ORDERS ==========
  fetchOrders: async (params = {}) => {
    set({ ordersLoading: true, ordersError: null });
    try {
      const response = await orderService.getAll(params);
      // Support both paginated ({ data, pagination }) and legacy flat array responses
      const payload = response.data;
      if (Array.isArray(payload)) {
        set({ orders: payload, ordersPagination: null, ordersLoading: false });
        return payload;
      }
      set({ orders: payload.data ?? [], ordersPagination: payload.pagination, ordersLoading: false });
      return payload.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error loading orders';
      set({ ordersError: msg, ordersLoading: false });
      throw err;
    }
  },

  createOrder: async (order) => {
    set({ ordersLoading: true, ordersError: null });
    try {
      const response = await orderService.create(order);
      const newOrder = response.data;
      set(state => ({ orders: [...state.orders, newOrder], ordersLoading: false }));
      return newOrder;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during creation';
      set({ ordersError: msg, ordersLoading: false });
      throw err;
    }
  },

  updateOrder: async (id, data) => {
    set({ ordersLoading: true, ordersError: null });
    try {
      const response = await orderService.update(id, data);
      // response.data is { message, order } — extract only the order object
      const updated = response.data.order || response.data;
      set(state => ({
        orders: state.orders.map(o => (o.id === id ? updated : o)),
        ordersLoading: false,
      }));
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during update';
      set({ ordersError: msg, ordersLoading: false });
      throw err;
    }
  },

  cancelOrder: async (id, reason) => {
    set({ ordersLoading: true, ordersError: null });
    try {
      const response = await orderService.cancel(id, reason);
      const updated = response.data.order;
      set(state => ({
        orders: state.orders.map(o => (o.id === id ? updated : o)),
        ordersLoading: false,
      }));
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during cancellation';
      set({ ordersError: msg, ordersLoading: false });
      throw err;
    }
  },

  // ========== CATEGORIES ==========
  fetchCategories: async (params = {}) => {
    set({ categoriesLoading: true, categoriesError: null });
    try {
      const response = await categoryService.getAll(params);
      set({ categories: response.data, categoriesLoading: false });
      return response.data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error loading categories';
      set({ categoriesError: msg, categoriesLoading: false });
      throw err;
    }
  },

  createCategory: async (category) => {
    set({ categoriesLoading: true, categoriesError: null });
    try {
      const response = await categoryService.create(category);
      const newCat = response.data;
      set(state => ({ categories: [...state.categories, newCat], categoriesLoading: false }));
      return newCat;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during creation';
      set({ categoriesError: msg, categoriesLoading: false });
      throw err;
    }
  },

  updateCategory: async (id, category) => {
    set({ categoriesLoading: true, categoriesError: null });
    try {
      const response = await categoryService.update(id, category);
      const updated = response.data;
      set(state => ({
        categories: state.categories.map(c => (c.id === id ? updated : c)),
        categoriesLoading: false,
      }));
      return updated;
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during update';
      set({ categoriesError: msg, categoriesLoading: false });
      throw err;
    }
  },

  deleteCategory: async (id) => {
    set({ categoriesLoading: true, categoriesError: null });
    try {
      await categoryService.delete(id);
      set(state => ({
        categories: state.categories.filter(c => c.id !== id),
        categoriesLoading: false,
      }));
    } catch (err) {
      const msg = err.response?.data?.message || 'Error during deletion';
      set({ categoriesError: msg, categoriesLoading: false });
      throw err;
    }
  },
}));

