import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages
import { Browse } from './pages/Browse';
import { MovieDetails } from './pages/MovieDetails';
import { SeatMap } from './pages/SeatMap';
import { Checkout } from './pages/Checkout';
import { Confirmation } from './pages/Confirmation';
import { MyBookings } from './pages/MyBookings';
import { StaffScanner } from './pages/StaffScanner';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Forbidden403 } from './pages/Forbidden403';
import { NotFound404 } from './pages/NotFound404';

// Admin Pages
import { Dashboard } from './pages/admin/Dashboard';
import { ShowsManager } from './pages/admin/ShowsManager';
import { MoviesManager } from './pages/admin/MoviesManager';
import { TheatresManager } from './pages/admin/TheatresManager';
import { AuditLogs } from './pages/admin/AuditLogs';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
          <Navbar />
          <main className="flex-grow">
            <Routes>
              {/* Public Discovery Routes */}
              <Route path="/" element={<Browse />} />
              <Route path="/movie/:id" element={<MovieDetails />} />
              <Route path="/shows/:id/seats" element={<SeatMap />} />

              {/* Customer Booking Flow (Requires Authentication) */}
              <Route
                path="/checkout"
                element={
                  <ProtectedRoute>
                    <Checkout />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/confirmation/:id"
                element={
                  <ProtectedRoute>
                    <Confirmation />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/my-bookings"
                element={
                  <ProtectedRoute>
                    <MyBookings />
                  </ProtectedRoute>
                }
              />

              {/* Staff Validation Route (STAFF or ADMIN) */}
              <Route
                path="/staff/scanner"
                element={
                  <ProtectedRoute allowedRoles={['STAFF', 'ADMIN']}>
                    <StaffScanner />
                  </ProtectedRoute>
                }
              />

              {/* Admin Panel Routes (ADMIN only) */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/shows"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <ShowsManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/movies"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <MoviesManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/theatres"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <TheatresManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/audit"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />

              {/* Auth & Error Pages */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/403" element={<Forbidden403 />} />
              <Route path="*" element={<NotFound404 />} />
            </Routes>
          </main>

          <footer className="bg-slate-900 border-t border-slate-800 py-6 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4">
              Algions AI Labs Cinema Hall Ticket Booking Engine • ACID Transactions & Atomic Holds
            </div>
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
