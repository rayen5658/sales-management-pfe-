import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// /client/login now redirects to the unified login page (/login)
// which has a "Client Portal" option built in.
export default function ClientLogin() {
  const navigate = useNavigate();
  useEffect(() => { navigate('/login', { replace: true }); }, [navigate]);
  return null;
}
