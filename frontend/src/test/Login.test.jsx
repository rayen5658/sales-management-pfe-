/**
 * Unit tests for Login.jsx
 * Tests the two-step login flow: role selector → credentials form
 * Requirements: 8.1, 8.2
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Login from '../pages/Login';

// ── Mock the auth stores ─────────────────────────────────────────────────────
const mockLogin = vi.fn();
const mockClientLogin = vi.fn();

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    login: mockLogin,
    isLoading: false,
  }),
}));

vi.mock('../stores/clientAuthStore', () => ({
  useClientAuthStore: () => ({
    login: mockClientLogin,
    isLoading: false,
  }),
}));

// ── Helper ───────────────────────────────────────────────────────────────────
function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login"     element={<Login />} />
        <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
        <Route path="/client/portal" element={<div data-testid="client-portal-page">Portal</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  mockLogin.mockReset();
  mockClientLogin.mockReset();
});

describe('Login — role selector and authentication flow', () => {

  // Login page shows role selector first
  it('renders role selector with Admin/Staff and Client Portal options', () => {
    renderLogin();
    expect(screen.getByText('Admin / Staff')).toBeInTheDocument();
    expect(screen.getByText('Client Portal')).toBeInTheDocument();
  });

  // Clicking Admin/Staff shows the credentials form
  it('clicking Admin/Staff reveals the email and password fields', () => {
    renderLogin();
    fireEvent.click(screen.getByText('Admin / Staff'));
    expect(screen.getByPlaceholderText(/firstname@domain/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/your password/i)).toBeInTheDocument();
  });

  // 7.11 Successful admin login navigates to /dashboard
  it('7.11 successful admin login navigates to /dashboard', async () => {
    mockLogin.mockResolvedValue({ success: true });

    renderLogin();

    // Step 1 — select role
    fireEvent.click(screen.getByText('Admin / Staff'));

    // Step 2 — fill credentials
    fireEvent.change(screen.getByPlaceholderText(/firstname@domain/i), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/your password/i), {
      target: { value: 'admin123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  // 7.11b Failed admin login stays on form and shows error
  it('7.11b failed admin login shows error message and stays on login', async () => {
    mockLogin.mockResolvedValue({ success: false, error: 'Incorrect email or password' });

    renderLogin();

    // Step 1 — select role
    fireEvent.click(screen.getByText('Admin / Staff'));

    // Step 2 — fill credentials
    fireEvent.change(screen.getByPlaceholderText(/firstname@domain/i), {
      target: { value: 'wrong@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/your password/i), {
      target: { value: 'wrongpass' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/incorrect email or password/i)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });

  // Back button returns to role selector
  it('Back button from admin form returns to role selector', () => {
    renderLogin();
    fireEvent.click(screen.getByText('Admin / Staff'));
    expect(screen.getByPlaceholderText(/firstname@domain/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText('Admin / Staff')).toBeInTheDocument();
    expect(screen.getByText('Client Portal')).toBeInTheDocument();
  });

  // Client Portal login navigates to /client/portal on success
  it('successful client login navigates to /client/portal', async () => {
    mockClientLogin.mockResolvedValue({ success: true });

    renderLogin();

    fireEvent.click(screen.getByText('Client Portal'));

    fireEvent.change(screen.getByPlaceholderText(/your@company/i), {
      target: { value: 'client@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/your password/i), {
      target: { value: 'clientpass' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId('client-portal-page')).toBeInTheDocument();
    });
  });

});
