import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginScreen } from './components/LoginScreen';
import { Role } from './data/posData';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CashierPage } from './pages/CashierPage';
import { CrewKitchenPage } from './pages/CrewKitchenPage';
import { QueueDisplayPage } from './pages/QueueDisplayPage';

function LoadingScreen() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#07090f] text-white">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
      <p className="text-sm font-bold tracking-wide text-white/70">
        Connecting to EL Farm Cafe Cloud...
      </p>
    </div>
  );
}

function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: Role[];
  children: React.ReactElement;
}) {
  const { profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!profile) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(profile.role)) {
    return (
      <Navigate
        to={profile.role === 'admin' ? '/admin' : '/cashier'}
        replace
      />
    );
  }

  return children;
}

function HomeRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!profile) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={profile.role === 'admin' ? '/admin' : '/cashier'}
      replace
    />
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route
            path="/cashier"
            element={
              <ProtectedRoute allowedRoles={['cashier', 'admin']}>
                <CashierPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/crew"
            element={
              <ProtectedRoute allowedRoles={['cashier', 'admin']}>
                <CrewKitchenPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/display"
            element={
              <ProtectedRoute allowedRoles={['cashier', 'admin']}>
                <QueueDisplayPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
