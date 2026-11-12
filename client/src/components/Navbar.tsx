import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, Ticket, QrCode, Shield, LogOut, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, isAdmin, isStaff, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link to="/" className="flex items-center space-x-2 text-indigo-400 font-bold text-xl tracking-wide">
            <Film className="w-6 h-6 text-indigo-500" />
            <span className="text-white">Algions<span className="text-indigo-400">Cinema</span></span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/" className="text-slate-300 hover:text-white transition font-medium text-sm">
              Browse Movies
            </Link>

            {isAuthenticated && (
              <Link to="/my-bookings" className="flex items-center space-x-1 text-slate-300 hover:text-white transition font-medium text-sm">
                <Ticket className="w-4 h-4 text-emerald-400" />
                <span>My Bookings</span>
              </Link>
            )}

            {isStaff && (
              <Link to="/staff/scanner" className="flex items-center space-x-1 text-slate-300 hover:text-white transition font-medium text-sm">
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>Ticket Scanner</span>
              </Link>
            )}

            {isAdmin && (
              <div className="relative group">
                <button className="flex items-center space-x-1 text-indigo-300 hover:text-indigo-200 transition font-medium text-sm">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>Admin Panel</span>
                </button>
                <div className="absolute left-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 hidden group-hover:block group-focus-within:block z-50">
                  <Link to="/admin/dashboard" className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
                    Dashboard & Reports
                  </Link>
                  <Link to="/admin/shows" className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
                    Shows Manager
                  </Link>
                  <Link to="/admin/movies" className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
                    Movies Manager
                  </Link>
                  <Link to="/admin/theatres" className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
                    Theatres & Screens
                  </Link>
                  <Link to="/admin/audit" className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-700">
                    Audit Trail
                  </Link>
                </div>
              </div>
            )}
          </nav>

          {/* User profile / actions */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-sm text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span className="font-medium text-slate-200">{user?.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    user?.role === 'ADMIN'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : user?.role === 'STAFF'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg shadow-sm transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

