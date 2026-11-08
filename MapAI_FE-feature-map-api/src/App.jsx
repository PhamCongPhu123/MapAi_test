import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/MainLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Explore from './pages/Explore'
import MapPage from './pages/MapPage'
import Profile from './pages/Profile'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './hooks/useAuth'

// Admin Pages
import AdminLayout from './pages/Admin/AdminLayout'
import Dashboard from './pages/Admin/Dashboard'
import UserManagement from './pages/Admin/UserManagement'
import LocationManagement from './pages/Admin/LocationManagement'

import './App.css'

function App() {
  const { user } = useAuth();

  // Helper to get redirect path based on role
  const getHomeRedirect = () => {
    if (user?.role === 'Admin' || user?.role == 0) return "/admin/dashboard";
    return "/";
  };

  return (
    <Routes>
      {/* Các trang có Header và Footer */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        
        {/* Auth routes - redirect to home if already logged in */}
        <Route path="/login" element={user ? <Navigate to={getHomeRedirect()} replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to={getHomeRedirect()} replace /> : <Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={user ? <Navigate to={getHomeRedirect()} replace /> : <ForgotPassword />} />

        {/* Protected routes within MainLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path="/explore" element={<Explore />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Protected routes OUTSIDE MainLayout (e.g. Map) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/map" element={<MapPage />} />
      </Route>

      {/* Admin Routes */}
      <Route element={<ProtectedRoute requiredRole="Admin" />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/locations" element={<LocationManagement />} />
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
