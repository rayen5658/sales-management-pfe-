import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { FiLogOut, FiMenu, FiX, FiHome, FiShoppingCart, FiUsers, FiPackage, FiGrid } from 'react-icons/fi';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">📊</span>
          <span className="brand-text">Sales Manager</span>
        </Link>

        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
        </button>

        <div className={`nav-menu ${menuOpen ? 'active' : ''}`}>
          <Link to="/" className={isActive('/')} onClick={() => setMenuOpen(false)}>
            <FiHome size={16} /> Dashboard
          </Link>
          <Link to="/products" className={isActive('/products')} onClick={() => setMenuOpen(false)}>
            <FiPackage size={16} /> Products
          </Link>
          <Link to="/categories" className={isActive('/categories')} onClick={() => setMenuOpen(false)}>
            <FiGrid size={16} /> Categories
          </Link>
          <Link to="/clients" className={isActive('/clients')} onClick={() => setMenuOpen(false)}>
            <FiUsers size={16} /> Clients
          </Link>
          <Link to="/orders" className={isActive('/orders')} onClick={() => setMenuOpen(false)}>
            <FiShoppingCart size={16} /> Orders
          </Link>
        </div>

        <div className="navbar-user">
          {user && (
            <>
              <span className="user-name">{user.firstname} {user.lastname}</span>
              <span className={`user-role role-${user.role_name}`}>{user.role_name}</span>
              <button className="logout-btn" onClick={handleLogout} title="Sign out">
                <FiLogOut size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
