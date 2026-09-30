import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authService } from '../services/api';
import AppLogo from '../components/common/AppLogo';
import DarkModeToggle from '../components/common/DarkModeToggle';

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  border: '1.5px solid var(--border)',
  borderRadius: '10px',
  fontSize: '0.95rem',
  outline: 'none',
  background: 'var(--card-bg-2)',
  color: 'var(--text)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token) { setError('This reset link is missing its token. Please request a new one.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'This reset link is invalid or has expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', background: 'var(--bg)', position: 'relative', padding: '1.5rem' }}>
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}>
        <DarkModeToggle size={36} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '18px', padding: '2.5rem', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'center' }}>
          <AppLogo size={40} showText={true} />
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text)', margin: '0 0 0.4rem', textAlign: 'center', letterSpacing: '-0.02em' }}>
          Set a new password
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 1.75rem', textAlign: 'center' }}>
          Choose a new password for your account
        </p>

        {done ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '1rem 1.1rem', color: '#15803d', fontSize: '0.875rem', lineHeight: 1.5, textAlign: 'center' }}>
            ✅ Password reset successful. Redirecting you to sign in...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {error && (
              <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '10px', padding: '0.75rem 1rem', color: 'var(--danger-text)', fontSize: '0.875rem' }}>
                ⚠ {error}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                New password
              </label>
              <input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" disabled={loading} autoComplete="new-password" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confirm password
              </label>
              <input type="password" style={inputStyle} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" disabled={loading} autoComplete="new-password" />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ width: '100%', padding: '0.85rem', background: loading ? '#5eead4' : 'linear-gradient(135deg,#0d9488,#115e59)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 16px rgba(13,148,136,0.35)', marginTop: '0.25rem' }}
            >
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem' }}>
          <Link to="/login" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
