import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { groupsAPI } from '../api/api';

export default function Home() {
  const { user, groups, totalOwe, totalOwedMe, fmt, dataLoading, refreshGroups, refreshMoney } = useApp();
  const navigate = useNavigate();

  // Keep the dashboard balances live as payments are confirmed/disputed.
  useEffect(() => {
    const sync = () => { refreshMoney(); refreshGroups(); };
    sync();
    const onFocus = () => sync();
    window.addEventListener('focus', onFocus);
    const id = setInterval(sync, 20000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gather recent expenses across all groups
  const recentExpenses = groups
    .flatMap(g => (g.expenses || []).slice(0, 2).map(e => ({ ...e, groupName: g.name })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className="app-shell">
      <TopNav />
      <div className="page-content fade-in">
        {/* Greeting */}
        <div className="home-header">
          <div>
            <div className="home-greeting">Good day 👋</div>
            <div className="home-name">Hey, {user?.name?.split(' ')[0] || 'there'}</div>
          </div>
          <button onClick={refreshGroups}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
            title="Refresh">🔄</button>
        </div>

        {/* Balance Card */}
        <div className="balance-card">
          <div className="balance-label">Total you owe</div>
          <div className="balance-amount">{fmt(totalOwe)}</div>
          <div className="balance-split">
            <div className="balance-sub">
              <div className="balance-sub-label">You owe</div>
              <div className="balance-sub-amount">{fmt(totalOwe)}</div>
            </div>
            <div className="balance-sub">
              <div className="balance-sub-label">Owed to you</div>
              <div className="balance-sub-amount">{fmt(totalOwedMe)}</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="section">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: '➕', label: 'Add Expense', path: '/add-expense', color: 'var(--purple-primary)' },
              { icon: '🤝', label: 'Settle Up',   path: '/settlement',  color: 'var(--green)' },
              { icon: '👥', label: 'New Group',   path: '/groups',      color: 'var(--orange)' },
              { icon: '📊', label: 'Dashboard',   path: '/dashboard',   color: 'var(--purple-light)' },
              { icon: '⚖️', label: 'Disputes',    path: '/disputes',    color: 'var(--red)' },
              { icon: '🧾', label: 'History',     path: '/history',     color: 'var(--purple-light)' },
            ].map((q, i) => (
              <button key={i} onClick={() => navigate(q.path)}
                style={{
                  width: '100%', height: 52, borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  color: q.color, transition: 'var(--transition)',
                }}>
                <span style={{ fontSize: 18 }}>{q.icon}</span> {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Groups */}
        <div className="section">
          <div className="section-header">
            <span className="section-title">Your Groups</span>
            <span className="section-link" onClick={() => navigate('/groups')}>See all</span>
          </div>

          {dataLoading ? (
            <div className="loading-dots"><div className="loading-dot"/><div className="loading-dot"/><div className="loading-dot"/></div>
          ) : groups.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👥</div>
              <div className="empty-state-title">No groups yet</div>
              <div className="empty-state-text">Create a group and start splitting expenses.</div>
            </div>
          ) : groups.map(g => {
            const bal = parseFloat(g.balance || 0);
            return (
              <div key={g.id} className="group-card" onClick={() => navigate(`/groups/${g.id}`)}>
                <div className={`group-icon ${g.icon_color || 'group-icon-purple'}`}>{g.icon || '💰'}</div>
                <div className="group-info">
                  <div className="group-name">{g.name}</div>
                  <div className="group-meta">{g.memberCount || 0} members · {g.expenseCount || 0} expenses</div>
                </div>
                {bal === 0
                  ? <span className="badge badge-gray">All settled</span>
                  : bal < 0
                    ? <span className="badge badge-red">Owe {fmt(bal)}</span>
                    : <span className="badge badge-green">Get {fmt(bal)}</span>
                }
              </div>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
