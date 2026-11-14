import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Explore from './pages/Explore'
import MapPage from './pages/MapPage'
import OfflineMapPage from './pages/OfflineMapPage'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { canUseGoogleWebLogin } from './config/platform'
import MapModeBoundary from './components/MapModeBoundary'
import Profile from './pages/Profile'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './hooks/useAuth'

// Admin Pages
import AdminLayout from './pages/Admin/AdminLayout'
import Dashboard from './pages/Admin/Dashboard'
import UserManagement from './pages/Admin/UserManagement'
import LocationManagement from './pages/Admin/LocationManagement'
import ContributionModeration from './pages/Admin/ContributionModeration'

import './App.css'

function App() {
  const { user } = useAuth();
  const location = useLocation();

  // Helper to get redirect path based on role
  const getHomeRedirect = () => {
    if (user?.role === 'Admin' || user?.role == 0) return "/admin/dashboard";
    const from = location.state?.from;
    return from ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/';
  };

  return (
    <Routes>
      {/* Các trang có Header và Footer */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        
        {/* Auth routes - redirect to home if already logged in */}
        <Route path="/login" element={user ? <Navigate to={getHomeRedirect()} replace /> : canUseGoogleWebLogin ? <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}><Login /></GoogleOAuthProvider> : <Login />} />
        <Route path="/register" element={user ? <Navigate to={getHomeRedirect()} replace /> : <Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={user ? <Navigate to={getHomeRedirect()} replace /> : <ForgotPassword />} />

        {/* Protected routes within MainLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/explore" element={<Explore />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Local exploration is public; online accounts/admin keep their existing guards. */}
      <Route path="/offline" element={<OfflineMapPage />} />
      <Route element={<MapModeBoundary />}>
        <Route path="/map" element={<MapPage />} />
        <Route path="/map/online" element={<MapPage />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute requiredRole="Admin" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/locations" element={<LocationManagement />} />
          <Route path="/admin/contributions" element={<ContributionModeration />} />
        </Route>
      </Route>

      {/* Reset Password - Outside all logic to ensure it loads */}
      <Route path="/reset-password" element={<ResetPassword />} />
      
      {/* Catch all - 404 or redirect */}
      <Route path="*" element={<Navigate to={getHomeRedirect()} replace />} />
    </Routes>
  )
}

export default App
