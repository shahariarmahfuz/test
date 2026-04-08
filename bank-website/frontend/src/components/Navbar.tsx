import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', label: 'Dashboard' },
    { to: '/transactions', label: 'Transactions' },
    { to: '/transfer', label: 'Transfer' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-primary-700 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="bg-white rounded-full p-1.5">
              <svg className="h-6 w-6 text-primary-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.5 1L2 6v2h19V6L11.5 1zM3 9v9H1v2h21v-2h-2V9H3zm4 0v9H5V9h2zm4 0v9H9V9h2zm4 0v9h-2V9h2zm4 0v9h-2V9h2z" />
              </svg>
            </div>
            <Link to="/" className="text-white font-bold text-xl tracking-wide">
              SecureBank
            </Link>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(to)
                    ? 'bg-primary-900 text-white'
                    : 'text-primary-100 hover:bg-primary-600 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* User & logout */}
          <div className="hidden md:flex items-center space-x-3">
            {user && (
              <div className="text-primary-100 text-sm">
                <span className="font-medium text-white">{user.full_name}</span>
                <span className="mx-1 text-primary-300">·</span>
                <span>@{user.username}</span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="bg-white text-primary-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary-50 transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="text-primary-100 hover:text-white focus:outline-none"
              aria-label="Toggle menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-primary-600">
          <div className="px-4 pt-2 pb-3 space-y-1">
            {navLinks.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium ${
                  isActive(to)
                    ? 'bg-primary-900 text-white'
                    : 'text-primary-100 hover:bg-primary-600 hover:text-white'
                }`}
              >
                {label}
              </Link>
            ))}
            {user && (
              <div className="border-t border-primary-600 pt-2 mt-2">
                <p className="text-primary-200 text-sm px-3 py-1">
                  {user.full_name} (@{user.username})
                </p>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-primary-100 hover:bg-primary-600 hover:text-white rounded-md font-medium"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
