/**
 * Helpers to set the zustand auth store state in tests.
 * Call setAuth(true) for an authenticated user, setAuth(false) for a guest.
 */
import { useAuthStore } from '../stores/authStore';

export const AUTHED_USER = {
  id: 1,
  firstname: 'Test',
  lastname: 'User',
  email: 'test@example.com',
  role_name: 'Sales Agent',
};

export const ADMIN_USER = {
  id: 2,
  firstname: 'Admin',
  lastname: 'User',
  email: 'admin@example.com',
  role_name: 'Administrator',
};

export function setAuth(authenticated, user = AUTHED_USER) {
  useAuthStore.setState({
    isAuthenticated: authenticated,
    user: authenticated ? user : null,
    token: authenticated ? 'fake-token' : null,
  });
}

export function resetAuth() {
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    token: null,
  });
}
