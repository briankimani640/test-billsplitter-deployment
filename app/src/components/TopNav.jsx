import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { notificationsAPI } from '../api/api';

function timeAgo(ts) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
const ICON = { payment_reminder: '⏰', settlement: '🤝', expense_added: '💸', system: '🔔' };

export default function TopNav({ title, showBack = false, onBack, rightAction }) {
  const { user } = useApp();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [items, setItems]   = useState([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.allSettled([
        notificationsAPI.list(), notificationsAPI.unreadCount(),
      ]);
      if (list.status === 'fulfilled')  setItems(list.value.data.slice(0, 5));
      if (count.status === 'fulfilled') setUnread(count.value.data.count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const openPanel = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    if (next) await refresh();
  };

  return (
    <header className="top-nav">
      {showBack ? (
        <button className="icon-btn" style={{ borderRadius: 'var(--radius-sm)' }}
          onClick={onBack || (() => navigate(-1))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : (
        <span className="top-nav-brand">SplitKesh</span>
      )}

      {title && (
        <span style={{ fontSize: 16, fontWeight: 700, flex: 1, textAlign: showBack ? 'center' : 'left', marginLeft: showBack ? 0 : 12 }}>
          {title}
        </span>
      )}

      <div className="top-nav-right">
        {rightAction || (
          <>
            <button className="icon-btn" onClick={openPanel} title="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {unread > 0 && <span className="notif-dot" />}
            </button>
            <div className="avatar-sm" onClick={() => navigate('/profile')} title="Profile">
              {user.initials}
            </div>
          </>
        )}
      </div>

      {notifOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 16,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '16px', width: 300, zIndex: 200,
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--text-secondary)' }}>NOTIFICATIONS</p>
            {unread > 0 && <span style={{ fontSize: 11, color: 'var(--purple-light)' }}>{unread} new</span>}
          </div>
          {items.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>You’re all caught up.</p>
          ) : items.map((n, i) => (
            <div key={n.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontSize: 20 }}>{ICON[n.type] || '🔔'}</span>
              <div>
                <p style={{ fontSize: 13 }}>{n.title}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{timeAgo(n.created_at)}</p>
              </div>
            </div>
          ))}
          <button onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
            style={{ width: '100%', marginTop: 12, padding: 8, background: 'var(--bg-card-alt)',
                     border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                     color: 'var(--purple-light)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            See all
          </button>
        </div>
      )}
    </header>
  );
}
