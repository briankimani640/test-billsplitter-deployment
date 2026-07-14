import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

// Full-screen loading spinner
function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'linear-gradient(135deg, var(--purple-dark), var(--purple-primary))',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        animation: 'pulse 1.4s ease-in-out infinite',
      }}>💸</div>
      <div className="loading-dots">
        <div className="loading-dot" />
        <div className="loading-dot" />
        <div className="loading-dot" />
      </div>
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(0.9);opacity:0.7} }`}</style>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useApp();

  if (loading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return children;
}
