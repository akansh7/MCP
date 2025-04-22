import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Home from './components/pages/Home';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Dashboard from './components/dashboard/Dashboard';
import ServerList from './components/servers/ServerList';
import CreateServer from './components/servers/CreateServer';
import ServerDetail from './components/servers/ServerDetail';
import ApiKeyForm from './components/servers/ApiKeyForm';
import Profile from './components/profile/Profile';
import NotFound from './components/pages/NotFound';
import './App.css';

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/servers" element={
                <ProtectedRoute>
                  <ServerList />
                </ProtectedRoute>
              } />
              
              <Route path="/servers/create" element={
                <ProtectedRoute>
                  <CreateServer />
                </ProtectedRoute>
              } />
              
              <Route path="/servers/:id" element={
                <ProtectedRoute>
                  <ServerDetail />
                </ProtectedRoute>
              } />
              
              <Route path="/servers/:id/apikey" element={
                <ProtectedRoute>
                  <ApiKeyForm />
                </ProtectedRoute>
              } />
              
              <Route path="/profile" element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } />
              
              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App; 