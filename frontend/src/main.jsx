import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Clear stale auth data that's missing role_name (from old sessions)
try {
  const raw = localStorage.getItem('auth-store');
  if (raw) {
    const stored = JSON.parse(raw);
    const user = stored?.state?.user;
    // If user exists but has no role_name, it's a stale session — clear it
    if (user && !user.role_name) {
      localStorage.removeItem('auth-store');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
    }
  }
} catch (_) {
  localStorage.removeItem('auth-store');
  localStorage.removeItem('auth_token');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
