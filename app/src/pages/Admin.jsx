import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { adminAPI } from '../api/api';

function Stat({ label, value }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '14px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--purple-light)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function Admin() {
  const { user, fmt, showToast } = useApp();
  const navigate = useNavigate();

  const [tab, setTab]           = useState('overview');
  const [overview, setOverview] = useState(null);
  const [metrics, setMetrics]   = useState(null);
  const [users, setUsers]       = useState([]);
  const [groups, setGroups]     = useState([]);
  const [q, setQ]               = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [o, m] = await Promise.allSettled([adminAPI.overview(), adminAPI.metrics()]);
      if (o.status === 'fulfilled') setOverview(o.value.data);
      if (m.status === 'fulfilled') setMetrics(m.value.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user?.is_admin) { navigate('/'); return; }
    loadAll();
  }, [user, loadAll, navigate]);

  const loadUsers  = async () => { try { setUsers((await adminAPI.users(q)).data); } catch {} };
  const loadGroups = async () => { try { setGroups((await adminAPI.groups()).data); } catch {} };

  useEffect(() => { if (tab === 'users')  loadUsers();  /* eslint-disable-next-line */ }, [tab]);
  useEffect(() => { if (tab === 'groups') loadGroups(); /* eslint-disable-next-line */ }, [tab]);

  const toggleAdmin = async (u) => {
    try {
      await adminAPI.setAdmin(u.id, !u.is_admin);
      showToast(`${u.name} is ${!u.is_admin ? 'now an admin' : 'no longer an admin'}`);
      loadUsers();
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Failed'));
    }
  };

  if (!user?.is_admin) return null;

  return (
    <div className="app-shell">
      <TopNav title="Admin" showBack />
      <div className="page-content fade-in">
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', margin: '8px 20px 16px' }}>
          {['overview', 'monitoring', 'users', 'groups'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', border: 'none', background: 'none',
              color: tab === t ? 'var(--purple-primary)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
              borderBottom: tab === t ? '2px solid var(--purple-primary)' : '2px solid transparent',
              textTransform: 'capitalize',
            }}>{t}</button>
          ))}
        </div>

        {tab === 'overview' && overview && (
          <div className="section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              <Stat label="Users" value={overview.users} />
              <Stat label="Verified" value={overview.verifiedUsers} />
              <Stat label="Admins" value={overview.admins} />
              <Stat label="Groups" value={overview.groups} />
              <Stat label="Expenses" value={overview.expenses} />
              <Stat label="Pending pay" value={overview.pendingSettlements} />
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)', padding: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total expense volume</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{fmt(overview.totalExpenseVolume)}</div>
            </div>
          </div>
        )}

        {tab === 'monitoring' && (
          <div className="section">
            {!metrics ? <p style={{ color: 'var(--text-muted)' }}>Loading metrics…</p> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  <Stat label="Requests 24h" value={metrics.summary.total} />
                  <Stat label="5xx errors" value={metrics.summary.errors} />
                  <Stat label="Avg ms" value={metrics.summary.avg_ms} />
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius)', padding: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Slowest requests (24h)</p>
                  {(metrics.slowest || []).map((s, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12,
                                          padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span>{s.method} {s.path}</span>
                      <span style={{ color: s.status >= 400 ? 'var(--red)' : 'var(--text-muted)' }}>
                        {s.status} · {s.duration_ms}ms
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'users' && (
          <div className="section">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search users…"
                style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)',
                         borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', padding: '10px 12px' }} />
              <button onClick={loadUsers}
                style={{ background: 'var(--purple-primary)', color: 'white', border: 'none',
                         borderRadius: 'var(--radius-sm)', padding: '0 14px', cursor: 'pointer' }}>Search</button>
            </div>
            {users.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                                       borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{u.name} {u.is_admin && <span style={{ color: 'var(--purple-light)' }}>★</span>}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {u.email} · {u.groupCount} groups {u.email_verified ? '· ✅' : '· ✉️'}
                  </div>
                </div>
                <button onClick={() => toggleAdmin(u)}
                  style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border)',
                           borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 12,
                           color: 'var(--text-primary)', cursor: 'pointer' }}>
                  {u.is_admin ? 'Revoke' : 'Make admin'}
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'groups' && (
          <div className="section">
            {groups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                                       borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 20 }}>{g.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    by {g.createdBy || '—'} · {g.memberCount} members · {g.expenseCount} expenses
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
