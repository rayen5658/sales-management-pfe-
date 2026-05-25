import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const useClientAuthStore = create(
  persist(
    (set, get) => ({
      client: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const res = await axios.post(`${BASE}/client-auth/login`, { email, password });
          const { token, client } = res.data;
          localStorage.setItem('client_token', token);
          set({ client, token, isAuthenticated: true, isLoading: false, error: null });
          return { success: true };
        } catch (err) {
          const msg = err.response?.data?.message || 'Login error';
          set({ error: msg, isLoading: false, isAuthenticated: false });
          return { success: false, error: msg };
        }
      },

      logout: () => {
        localStorage.removeItem('client_token');
        localStorage.removeItem('client-auth-store');
        set({ client: null, token: null, isAuthenticated: false, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'client-auth-store',
      partialize: (state) => ({
        client: state.client,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
