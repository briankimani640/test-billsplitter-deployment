import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import MemberPicker from '../components/MemberPicker';
import { useApp } from '../context/AppContext';
import { groupsAPI } from '../api/api';

const ICONS = ['💰', '🏠', '✈️', '🍔', '🎉', '🚗', '🛒', '⚡'];
const COLORS = [
  'group-icon-purple', 'group-icon-blue', 'group-icon-teal',
  'group-icon-orange', 'group-icon-pink', 'group-icon-gray',
];

export default function Groups() {
  const { groups, fmt, user, showToast, refreshGroups } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  // Create-group modal state
  const [showModal, setShowModal] = useState(false);
  const [name, setName]           = useState('');
  const [icon, setIcon]           = useState('💰');
  const [iconColor, setIconColor] = useState('group-icon-purple');
  const [members, setMembers]     = useState([]);
  const [saving, setSaving]       = useState(false);

  const filtered = groups.filter(g => {
    if (filter === 'owe') return g.balance < 0;
    if (filter === 'owed') return g.balance > 0;
    if (filter === 'settled') return g.balance === 0;
    return true;
  });

  const resetForm = () => {
    setName(''); setIcon('💰'); setIconColor('group-icon-purple'); setMembers([]);
  };

  const handleCreate = async () => {
    if (!name.trim()) { showToast('⚠️ Group name is required'); return; }
    if (members.length + 1 > 10) { showToast('⚠️ Max 10 members per group'); return; }
    setSaving(true);
    try {
      const res = await groupsAPI.createWithMembers(
        name.trim(), icon, iconColor, members.map(m => m.id)
      );
      await refreshGroups();
      showToast('✅ Group created!');
      setShowModal(false);
      resetForm();
      if (res.data?.id) navigate(`/groups/${res.data.id}`);
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Could not create group'));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
    fontFamily: 'Inter, sans-serif', fontSize: 14, padding: '11px 14px',
    outline: 'none', boxSizing: 'border-box', marginBottom: 14,
  };

  return (
    <div className="app-shell">
      <TopNav title="All Groups" showBack />
      <div className="page-content fade-in">
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '16px 20px 8px', overflowX: 'auto' }}>
          {['all', 'owe', 'owed', 'settled'].map(f => (
            <button
              key={f}
              style={{
                padding: '8px 16px', borderRadius: 20, border: '1px solid',
                borderColor: filter === f ? 'var(--purple-primary)' : 'var(--border)',
                background: filter === f ? 'rgba(124,92,252,0.15)' : 'var(--bg-card)',
                color: filter === f ? 'var(--purple-primary)' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'var(--transition)',
              }}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'owe' ? 'I Owe' : f === 'owed' ? 'Owed to Me' : 'Settled'}
            </button>
          ))}
        </div>

        <div className="section" style={{ marginTop: 8 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💼</div>
              <div className="empty-state-title">No groups found</div>
              <div className="empty-state-text">Try a different filter or create a new group.</div>
            </div>
          ) : filtered.map(g => (
            <div key={g.id} className="group-card" onClick={() => navigate(`/groups/${g.id}`)}>
              <div className={`group-icon ${g.icon_color || g.iconColor}`}>{g.icon}</div>
              <div className="group-info">
                <div className="group-name">{g.name}</div>
                <div className="group-meta">{g.memberCount} members · {g.expenseCount} expenses</div>
              </div>
              {g.balance === 0
                ? <span className="badge badge-gray">All settled</span>
                : g.balance < 0
                  ? <span className="badge badge-red">Owe {fmt(g.balance)}</span>
                  : <span className="badge badge-green">Get {fmt(g.balance)}</span>
              }
            </div>
          ))}
        </div>

        <div className="px-20 mb-20">
          <button className="btn btn-outline" onClick={() => { resetForm(); setShowModal(true); }}>
            ➕ Create New Group
          </button>
        </div>
      </div>

      {/* Create Group modal */}
      {showModal && (
        <div onClick={() => !saving && setShowModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300,
                   display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)',
                     borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)',
                     borderTop: '1px solid var(--border)', padding: 20, maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Create Group</h3>
              <button onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>

            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Group name</label>
            <input style={inputStyle} placeholder="e.g. Nairobi Flatmates"
              value={name} onChange={e => setName(e.target.value)} autoFocus />

            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Icon</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0 14px' }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setIcon(ic)}
                  style={{ fontSize: 20, width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
                           background: icon === ic ? 'rgba(124,92,252,0.2)' : 'var(--bg-input)',
                           border: icon === ic ? '1px solid var(--purple-primary)' : '1px solid var(--border)' }}>
                  {ic}
                </button>
              ))}
            </div>

            <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Colour</label>
            <div style={{ display: 'flex', gap: 8, margin: '8px 0 14px' }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setIconColor(c)}
                  className={`group-icon ${c}`}
                  style={{ width: 34, height: 34, cursor: 'pointer',
                           outline: iconColor === c ? '2px solid var(--purple-light)' : 'none' }} />
              ))}
            </div>

            <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              Add members (you’re included automatically · max 10)
            </label>
            <MemberPicker selected={members} onChange={setMembers}
              excludeIds={[user?.id]} showToast={showToast} />

            <button onClick={handleCreate} disabled={saving}
              style={{ width: '100%', marginTop: 18, padding: '13px',
                       background: 'linear-gradient(135deg, var(--purple-dark), var(--purple-primary))',
                       color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
                       fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
