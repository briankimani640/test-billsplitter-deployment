import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [pwd, setPwd]         = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (pwd.length < 6)     { setError('Password must be at least 6 characters'); return; }
    if (pwd !== confirm)    { setError('Passwords do not match'); return; }
    if (!token)             { setError('Missing or invalid reset link'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(token, pwd);
      setDone(true);
      setTimeout(() => navigate('/login'), 2200);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 14,
    padding: '13px 14px', outline: 'none', boxSizing: 'border-box', marginBottom: 14,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--bg-card)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 28 }}>
        <h2 style={{ marginTop: 0 }}>Set a new password</h2>
        {done ? (
          <p style={{ color: 'var(--green)' }}>✅ Password reset! Redirecting to login…</p>
        ) : (
          <form onSubmit={submit}>
            <input style={inputStyle} type="password" placeholder="New password (min 6 chars)"
              value={pwd} onChange={e => setPwd(e.target.value)} required />
            <input style={inputStyle} type="password" placeholder="Confirm new password"
              value={confirm} onChange={e => setConfirm(e.target.value)} required />
            {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>⚠️ {error}</p>}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 13, background: 'var(--purple-primary)', color: 'white',
                       border: 'none', borderRadius: 'var(--radius-sm)', fontWeight: 700,
                       cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
