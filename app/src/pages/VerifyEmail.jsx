import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [state, setState] = useState('loading'); // loading | ok | error

  useEffect(() => {
    if (!token) { setState('error'); return; }
    authAPI.verifyEmail(token)
      .then(() => setState('ok'))
      .catch(() => setState('error'));
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
      <div style={{ maxWidth: 400, background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)', padding: 32 }}>
        {state === 'loading' && <p>Verifying your email…</p>}
        {state === 'ok' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h2 style={{ marginTop: 0 }}>Email verified</h2>
            <p style={{ color: 'var(--text-muted)' }}>Your email address is now confirmed.</p>
            <button onClick={() => navigate('/')}
              style={{ marginTop: 12, padding: '12px 22px', background: 'var(--purple-primary)',
                       color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
                       fontWeight: 700, cursor: 'pointer' }}>Continue</button>
          </>
        )}
        {state === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ marginTop: 0 }}>Link invalid or expired</h2>
            <p style={{ color: 'var(--text-muted)' }}>Request a new verification link from your profile.</p>
            <button onClick={() => navigate('/login')}
              style={{ marginTop: 12, padding: '12px 22px', background: 'var(--purple-primary)',
                       color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
                       fontWeight: 700, cursor: 'pointer' }}>Back to login</button>
          </>
        )}
      </div>
    </div>
  );
}
