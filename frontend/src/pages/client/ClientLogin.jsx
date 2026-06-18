// ClientLogin.jsx is no longer needed — /client/login now points directly to Login
// This file is kept only so the route import in App.jsx doesn't break
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
export default function ClientLogin() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/login', { replace: true }); }, [navigate]);
  return null;
}
