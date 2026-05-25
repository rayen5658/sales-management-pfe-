/**
 * Unit tests for Login.jsx
 * Feature: welcome-page-upgrade
 * Task: 7.11 — Successful login calls navigate('/dashboard')
 * Requirements: 8.1, 8.2
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Login from '../pages/Login';

// ── Mock the auth store ──────────────────────────────────────────────────────
// We control what `login()` returns so no real API call is made.
const mockLogin = vi.fn();

vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({
    login: mockLogin,
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
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  mockLogin.mockReset();
});

describe('Login — routing after authentication', () => {

  // 7.11 Successful login navigates to /dashboard
  it('7.11 successful login navigates to /dashboard', async () => {
    mockLogin.mockResolvedValue({ success: true });

    renderLogin();

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'admin123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  // Bonus: failed login stays on /login and shows an error
  it('7.11b failed login stays on /login and shows error message', async () => {
    mockLogin.mockResolvedValue({ success: false, error: 'Email ou mot de passe incorrect' });

    renderLogin();

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'wrong@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /entrer/i }));

    await waitFor(() => {
      expect(screen.getByText(/email ou mot de passe incorrect/i)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
  });

});
