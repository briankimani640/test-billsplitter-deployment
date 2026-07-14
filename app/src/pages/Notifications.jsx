import React, { useEffect, useState, useCallback } from 'react';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { notificationsAPI } from '../api/api';

const ICON = {
  payment_reminder: '⏰',
  settlement:       '🤝',
  expense_added:    '💸',
  system:           '🔔',
};

function timeAgo(ts) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export default function Notifications() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await notificationsAPI.list();
      setItems(res.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await notificationsAPI.markRead(id).catch(() => {});
    setItems(items.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };
  const markAll = async () => {
    await notificationsAPI.markAllRead().catch(() => {});
    setItems(items.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  };
  const remove = async (id) => {
    await notificationsAPI.remove(id).catch(() => {});
    setItems(items.filter(n => n.id !== id));
  };

  return (
    <div className="app-shell">
      <TopNav title="Notifications" showBack />
      <div className="page-content fade-in">
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px 0' }}>
          {items.some(n => !n.read_at) && (
            <button onClick={markAll}
              style={{ background: 'none', border: 'none', color: 'var(--purple-light)',
                       fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Mark all read
            </button>
          )}
        </div>

        <div className="section">
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</p>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔔</div>
              <div className="empty-state-title">No notifications</div>
              <div className="empty-state-text">You’re all caught up.</div>
            </div>
          ) : items.map(n => (
            <div key={n.id} onClick={() => !n.read_at && markRead(n.id)}
              style={{ display: 'flex', gap: 12, padding: '14px', marginBottom: 8,
                       background: n.read_at ? 'var(--bg-card)' : 'rgba(124,92,252,0.08)',
                       border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                       cursor: n.read_at ? 'default' : 'pointer' }}>
              <span style={{ fontSize: 22 }}>{ICON[n.type] || '🔔'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{n.title}</div>
                {n.body && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.created_at)}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
