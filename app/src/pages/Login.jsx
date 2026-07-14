import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { authAPI } from '../api/api';

export default function Login() {
  const { login, register, showToast } = useApp();
  const navigate = useNavigate();

  const [mode,      setMode]      = useState('login'); // 'login' | 'register' | 'forgot'
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [info,      setInfo]      = useState('');

  // Form fields
  const [name,     setName]     = useState('');
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [phone,    setPhone]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPwd,  setShowPwd]  = useState(false);

  const handleForgot = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!email) { setError('Enter your email'); return; }
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email);
      setInfo(res.data?.message || 'If that email exists, a reset link has been sent.');
    } catch {
      setInfo('If that email exists, a reset link has been sent.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');

    if (mode === 'register') {
      if (!name.trim())        { setError('Name is required'); return; }
      if (!username.trim())    { setError('Username is required'); return; }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) { setError('Username must be 3-20 letters, numbers or underscores'); return; }
      if (phone && phone.replace(/\D/g, '').length !== 10) { setError('Phone must be exactly 10 digits'); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (password !== confirm) { setError('Passwords do not match'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password, phone, username.trim());
      }
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', background: 'var(--bg-input)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif',
    fontSize: 14, padding: '13px 14px', outline: 'none',
    transition: 'var(--transition)', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          width: 68, height: 68, borderRadius: 20, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, var(--purple-dark), var(--purple-primary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 32, boxShadow: 'var(--shadow-purple)',
        }}>💸</div>
        <h1 style={{
          fontSize: 28, fontWeight: 800, letterSpacing: -0.5,
          background: 'linear-gradient(135deg, var(--purple-primary), var(--purple-light))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>SplitKesh</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
          Split expenses. Settle smarter.
        </p>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '28px 24px',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Mode Toggle */}
        {mode !== 'forgot' && (
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: 24 }}>
          {[['login','Log In'],['register','Sign Up']].map(([v, l]) => (
            <button key={v} onClick={() => { setMode(v); setError(''); setInfo(''); }}
              style={{
                flex: 1, padding: '10px', borderRadius: 6, border: 'none',
                background: mode === v ? 'var(--purple-primary)' : 'transparent',
                color: mode === v ? 'white' : 'var(--text-muted)',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'var(--transition)',
              }}>{l}</button>
          ))}
        </div>
        )}

        {info && (
          <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid var(--green)',
                        borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                        color: 'var(--green)', fontSize: 13, marginBottom: 16 }}>
            ✅ {info}
          </div>
        )}

        {mode === 'forgot' ? (
          <form onSubmit={handleForgot}>
            <h3 style={{ marginTop: 0 }}>Reset your password</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
              Enter your email and we’ll send you a reset link.
            </p>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>Email</label>
              <input style={inputStyle} type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {error && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid var(--red)',
                            borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                            color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
            )}
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '14px',
                       background: 'linear-gradient(135deg, var(--purple-dark), var(--purple-primary))',
                       color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
                       fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
              <span style={{ color: 'var(--purple-light)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => { setMode('login'); setError(''); setInfo(''); }}>← Back to login</span>
            </p>
          </form>
        ) : (
        <form onSubmit={handleSubmit}>
          {/* Register-only fields */}
          {mode === 'register' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
                  Full Name
                </label>
                <input style={inputStyle} type="text" placeholder="e.g. Brian Mwangi"
                  value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
                  Username
                </label>
                <input style={inputStyle} type="text" placeholder="e.g. brian_m"
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/\s/g, ''))} required />
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  This is how friends find and add you. 3–20 letters, numbers or underscores.
                </p>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
                  Phone (optional)
                </label>
                <input style={inputStyle} type="tel" placeholder="+254712345678"
                  value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </>
          )}

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
              Email
            </label>
            <input style={inputStyle} type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          {/* Password */}
          <div style={{ marginBottom: mode === 'register' ? 14 : 22, position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
              Password
            </label>
            <input
              style={{ ...inputStyle, paddingRight: 44 }}
              type={showPwd ? 'text' : 'password'}
              placeholder={mode === 'login' ? 'Your password' : 'At least 6 characters'}
              value={password} onChange={e => setPassword(e.target.value)} required
            />
            <button type="button" onClick={() => setShowPwd(p => !p)}
              style={{ position: 'absolute', right: 12, bottom: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>
              {showPwd ? '🙈' : '👁️'}
            </button>
          </div>

          {/* Confirm password */}
          {mode === 'register' && (
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 7 }}>
                Confirm Password
              </label>
              <input style={inputStyle} type={showPwd ? 'text' : 'password'} placeholder="Repeat password"
                value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
          )}

          {mode === 'login' && (
            <p style={{ textAlign: 'right', margin: '-6px 0 16px' }}>
              <span style={{ color: 'var(--purple-light)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}>
                Forgot password?
              </span>
            </p>
          )}

          {/* Error */}
          {error && (
            <div style={{
              background: 'var(--red-bg)', border: '1px solid var(--red)',
              borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              color: 'var(--red)', fontSize: 13, marginBottom: 16,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: loading ? 'var(--purple-dark)' : 'linear-gradient(135deg, var(--purple-dark), var(--purple-primary))',
              color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
              fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-purple)', transition: 'var(--transition)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {loading ? (
              <>
                <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                {mode === 'login' ? 'Signing in…' : 'Creating account…'}
              </>
            ) : (
              mode === 'login' ? '🔑 Log In' : '🚀 Create Account'
            )}
          </button>
        </form>
        )}
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 20, display: mode === 'forgot' ? 'none' : 'block' }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <span style={{ color: 'var(--purple-light)', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setInfo(''); }}>
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </span>
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
