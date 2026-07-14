import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import ProtectedRoute from './components/ProtectedRoute';
import './styles/global.css';

// Pages
import Login         from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail   from './pages/VerifyEmail';
import Home          from './pages/Home';
import Groups        from './pages/Groups';
import GroupDetail   from './pages/GroupDetail';
import AddExpense    from './pages/AddExpense';
import IOUs          from './pages/IOUs';
import Dashboard     from './pages/Dashboard';
import Settlement    from './pages/Settlement';
import Disputes      from './pages/Disputes';
import History       from './pages/History';
import Profile       from './pages/Profile';
import Notifications from './pages/Notifications';
import Admin         from './pages/Admin';

function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"          element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email"   element={<VerifyEmail />} />

          {/* Protected */}
          <Route path="/"              element={<Protected><Home /></Protected>} />
          <Route path="/groups"        element={<Protected><Groups /></Protected>} />
          <Route path="/groups/:id"    element={<Protected><GroupDetail /></Protected>} />
          <Route path="/add-expense"   element={<Protected><AddExpense /></Protected>} />
          <Route path="/ious"          element={<Protected><IOUs /></Protected>} />
          <Route path="/dashboard"     element={<Protected><Dashboard /></Protected>} />
          <Route path="/settlement"    element={<Protected><Settlement /></Protected>} />
          <Route path="/disputes"      element={<Protected><Disputes /></Protected>} />
          <Route path="/history"       element={<Protected><History /></Protected>} />
          <Route path="/profile"       element={<Protected><Profile /></Protected>} />
          <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
          <Route path="/admin"         element={<Protected><Admin /></Protected>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </BrowserRouter>
  );
}
