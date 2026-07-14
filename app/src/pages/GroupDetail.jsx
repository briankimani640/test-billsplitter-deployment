import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { groupsAPI, expensesAPI } from '../api/api';
import MemberPicker from '../components/MemberPicker';

function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '10px', border: 'none', background: 'none',
      color: active ? 'var(--purple-primary)' : 'var(--text-muted)',
      fontSize: 14, fontWeight: active ? 700 : 500, cursor: 'pointer',
      borderBottom: active ? '2px solid var(--purple-primary)' : '2px solid transparent',
      transition: 'var(--transition)',
    }}>{label}</button>
  );
}

export default function GroupDetail() {
  const { id } = useParams();
  const { user, fmt, showToast, refreshGroups } = useApp();
  const navigate = useNavigate();

  const [group,   setGroup]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('expenses');
  const [expandedId, setExpandedId] = useState(null);

  const [showAddMember, setShowAddMember] = useState(false);
  const [picked,        setPicked]        = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const loadGroup = useCallback(async () => {
    try {
      setLoading(true);
      const res = await groupsAPI.get(id);
      setGroup(res.data);
    } catch (err) {
      showToast('❌ Could not load group');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadGroup(); }, [loadGroup]);

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await expensesAPI.delete(expenseId);
      showToast('🗑️ Expense deleted');
      await loadGroup();
      await refreshGroups();
    } catch { showToast('❌ Failed to delete expense'); }
  };

  const handleAddMembers = async () => {
    if (!picked.length) { showToast('Pick at least one person'); return; }
    const current = (group?.members || []).length;
    if (current + picked.length > 10) {
      showToast('⚠️ Max 10 members per group'); return;
    }
    setAddingMembers(true);
    try {
      for (const p of picked) {
        await groupsAPI.addMember(id, p.id);
      }
      showToast(`✅ Added ${picked.length} member${picked.length > 1 ? 's' : ''}`);
      setShowAddMember(false);
      setPicked([]);
      await loadGroup();
      await refreshGroups();
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Could not add members'));
    } finally {
      setAddingMembers(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the group?')) return;
    try {
      await groupsAPI.removeMember(id, memberId);
      showToast('Member removed');
      await loadGroup();
      await refreshGroups();
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Could not remove member'));
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Delete "${group?.name}"? This removes the group and all its expenses for everyone. This cannot be undone.`)) return;
    try {
      await groupsAPI.delete(id);
      showToast('👋 Sorry to see you go. Group deleted.', 3500);
      await refreshGroups();
      navigate('/', { replace: true });
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Could not delete group'));
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm(`Leave "${group?.name}"? You can only leave once you've settled everything you owe here.`)) return;
    try {
      await groupsAPI.leave(id);
      showToast('👋 You have left the group.');
      await refreshGroups();
      navigate('/', { replace: true });
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Could not leave group'));
    }
  };

  if (loading) return (
    <div className="app-shell">
      <TopNav showBack title="" />
      <div className="page-content" style={{ display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div className="loading-dots"><div className="loading-dot"/><div className="loading-dot"/><div className="loading-dot"/></div>
      </div>
      <BottomNav />
    </div>
  );

  if (!group) return null;

  const totalSpent = (group.expenses || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const myBalance  = parseFloat(group.balance || 0);
  const isGroupAdmin = (group.members || []).find(m => m.id === user?.id)?.role === 'admin';
  const atMemberLimit = (group.members || []).length >= 10;

  return (
    <div className="app-shell">
      <TopNav showBack title="" rightAction={
        <button onClick={() => navigate('/add-expense', { state: { groupId: id } })}
          style={{ background:'var(--purple-primary)', border:'none', color:'white', borderRadius:'var(--radius-sm)', padding:'8px 14px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
          + Add
        </button>
      }/>
      <div className="page-content fade-in">
        {/* Hero */}
        <div className="group-detail-hero">
          <div className={`group-detail-icon ${group.icon_color || 'group-icon-purple'}`}>{group.icon || '💰'}</div>
          <div className="group-detail-title">{group.name}</div>
          <div className="group-detail-meta">{(group.members||[]).length} members · {(group.expenses||[]).length} expenses</div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-box">
            <div className="stat-box-value" style={{fontSize:15}}>{fmt(totalSpent)}</div>
            <div className="stat-box-label">Total</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-value" style={{ fontSize:15, color: myBalance < 0 ? 'var(--red)' : myBalance > 0 ? 'var(--green)' : 'var(--gray)' }}>
              {myBalance === 0 ? 'Settled' : (myBalance < 0 ? '−' : '+') + fmt(myBalance)}
            </div>
            <div className="stat-box-label">Your balance</div>
          </div>
          <div className="stat-box">
            <div className="stat-box-value">{(group.members||[]).length}</div>
            <div className="stat-box-label">Members</div>
          </div>
        </div>

        {myBalance !== 0 && (
          <div className="px-20 mb-20" style={{ display:'flex', gap:10 }}>
            <button className="btn btn-primary btn-sm" style={{flex:1}} onClick={() => navigate('/settlement')}>🤝 Settle Up</button>
            <button className="btn btn-outline btn-sm" style={{flex:1}} onClick={() => navigate('/add-expense', { state: { groupId: id } })}>➕ Add Expense</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', margin:'0 20px 16px' }}>
          <Tab label="Expenses" active={tab==='expenses'} onClick={() => setTab('expenses')} />
          <Tab label="Members"  active={tab==='members'}  onClick={() => setTab('members')} />
          <Tab label="Balances" active={tab==='balances'} onClick={() => setTab('balances')} />
        </div>

        {/* Expenses Tab */}
        {tab === 'expenses' && (
          <div className="section">
            {(group.expenses||[]).length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🧾</div>
                <div className="empty-state-title">No expenses yet</div>
              </div>
            ) : (group.expenses||[]).map(e => {
              const share = parseFloat(e.yourSplit || e.yourShare || 0);
              const isPayer = e.paid_by === user?.id;
              const splits = e.splits || [];
              const open = expandedId === e.id;
              return (
                <div key={e.id} style={{ marginBottom:8 }}>
                  <div className="expense-item"
                    onClick={() => setExpandedId(open ? null : e.id)}
                    onContextMenu={(ev) => { ev.preventDefault(); handleDeleteExpense(e.id); }}
                    style={{ cursor:'pointer' }}>
                    <div className="expense-icon">{e.emoji || '📦'}</div>
                    <div className="expense-info">
                      <div className="expense-desc">{e.description}</div>
                      <div className="expense-payer">
                        {isPayer ? 'You paid' : `${e.paidByName || 'Someone'} paid`} · {new Date(e.date).toLocaleDateString('en-KE',{month:'short',day:'numeric'})} · {open ? 'hide' : 'tap for split'}
                      </div>
                    </div>
                    <div className="expense-amounts">
                      <div className="expense-total">{fmt(e.amount)}</div>
                      <div className="expense-share" style={{ color: isPayer ? 'var(--green)' : 'var(--red)' }}>
                        {isPayer ? `+${fmt(parseFloat(e.amount) - share)}` : `−${fmt(share)}`}
                      </div>
                    </div>
                  </div>

                  {open && (
                    <div style={{background:'var(--bg-card-alt)',border:'1px solid var(--border)',borderTop:'none',
                                 borderRadius:'0 0 var(--radius-sm) var(--radius-sm)',padding:'12px 14px',marginTop:-4}}>
                      <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:10}}>
                        Who owes what
                      </div>
                      {splits.length === 0 ? (
                        <div style={{fontSize:13,color:'var(--text-muted)'}}>No split details recorded.</div>
                      ) : splits.map(sp => {
                        const isMe    = sp.userId === user?.id;
                        const paidByThis = sp.userId === e.paid_by;
                        return (
                          <div key={sp.userId} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0'}}>
                            <div className="member-avatar" style={{width:28,height:28,fontSize:11}}>{sp.initials || sp.name?.[0]}</div>
                            <div style={{flex:1,fontSize:14}}>
                              {isMe ? 'You' : sp.name}
                              {paidByThis && <span style={{fontSize:11,color:'var(--green)',marginLeft:6}}>· paid the bill</span>}
                            </div>
                            <div style={{fontSize:14,fontWeight:700}}>{fmt(sp.amount)}</div>
                          </div>
                        );
                      })}
                      <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px dashed var(--border)',marginTop:8,paddingTop:8,fontSize:13}}>
                        <span style={{color:'var(--text-muted)'}}>Total</span>
                        <strong>{fmt(e.amount)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{marginTop:16}}>
              <button className="btn btn-outline" onClick={() => navigate('/add-expense', { state: { groupId: id } })}>
                ➕ Add Expense
              </button>
            </div>
            <p style={{fontSize:12,color:'var(--text-muted)',textAlign:'center',marginTop:8}}>Long-press an expense to delete it</p>
          </div>
        )}

        {/* Members Tab */}
        {tab === 'members' && (
          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {(group.members || []).length} / 10 members
              </span>
              {isGroupAdmin && (
                <button onClick={() => { setPicked([]); setShowAddMember(true); }}
                  disabled={atMemberLimit}
                  style={{ background: 'var(--purple-primary)', border: 'none', color: 'white',
                           borderRadius: 'var(--radius-sm)', padding: '7px 12px', fontSize: 13,
                           fontWeight: 600, cursor: atMemberLimit ? 'not-allowed' : 'pointer',
                           opacity: atMemberLimit ? 0.5 : 1 }}>
                  ＋ Add member
                </button>
              )}
            </div>
            {atMemberLimit && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                This group has reached the 10-member limit.
              </p>
            )}
            <div className="member-list">
              {(group.members||[]).map(m => {
                const bal = parseFloat(m.balance || 0);
                const isMe = m.id === user?.id;
                return (
                  <div key={m.id} className="member-item">
                    <div className="member-avatar">{m.initials || m.name?.[0] || '?'}</div>
                    <div style={{ flex: 1 }}>
                      <div className="member-name">{m.name} {isMe ? '(You)' : ''}</div>
                      <div className="member-role">{m.role}</div>
                    </div>
                    <div className="member-balance">
                      <div className="member-balance-amount" style={{ color: bal < 0 ? 'var(--red)' : bal > 0 ? 'var(--green)' : 'var(--gray)' }}>
                        {bal === 0 ? '—' : (bal > 0 ? '+' : '−') + fmt(bal)}
                      </div>
                      <div className="member-balance-label">{bal < 0 ? 'owes' : bal > 0 ? 'gets back' : 'settled'}</div>
                    </div>
                    {isGroupAdmin && !isMe && (
                      <button onClick={() => handleRemoveMember(m.id)} title="Remove member"
                        style={{ marginLeft: 8, background: 'none', border: 'none',
                                 color: 'var(--red)', cursor: 'pointer', fontSize: 16 }}>✕</button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16, display:'grid', gap:10 }}>
              <button onClick={handleLeaveGroup}
                style={{ width: '100%', padding: '12px', background: 'var(--bg-card-alt)',
                         color: 'var(--text-secondary)', border: '1px solid var(--border)',
                         borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                🚪 Leave group
              </button>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin:0 }}>
                You can leave only after settling everything you owe in this group.
              </p>

              {isGroupAdmin && (
                <>
                  <button onClick={handleDeleteGroup}
                    style={{ width: '100%', padding: '12px', background: 'var(--red-bg)',
                             color: 'var(--red)', border: '1px solid var(--red)',
                             borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    🗑️ Delete group
                  </button>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin:0 }}>
                    Admin only. A group can't be deleted while it has unsettled bills.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
        {tab === 'balances' && (
          <div className="section">
            {(group.members||[]).filter(m => m.id !== user?.id && parseFloat(m.balance||0) !== 0).length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✅</div>
                <div className="empty-state-title">All settled!</div>
                <div className="empty-state-text">No outstanding balances.</div>
              </div>
            ) : (group.members||[]).filter(m => m.id !== user?.id && parseFloat(m.balance||0) !== 0).map(m => {
              const owesYou = parseFloat(m.balance||0) < 0;
              return (
                <div key={m.id} className="settlement-card" onClick={() => navigate('/settlement')}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <div className="member-avatar">{m.initials}</div>
                      <div>
                        <div style={{fontSize:14,fontWeight:600}}>{m.name}</div>
                        <div style={{fontSize:12,color:'var(--text-muted)'}}>{owesYou ? 'owes you' : 'you owe'}</div>
                      </div>
                    </div>
                    <div style={{fontSize:18,fontWeight:800,color:owesYou?'var(--green)':'var(--red)'}}>
                      {fmt(Math.abs(parseFloat(m.balance)))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Add Member modal */}
      {showAddMember && (
        <div onClick={() => !addingMembers && setShowAddMember(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300,
                   display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)',
                     borderTopLeftRadius: 'var(--radius-lg)', borderTopRightRadius: 'var(--radius-lg)',
                     borderTop: '1px solid var(--border)', padding: 20, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Add members</h3>
              <button onClick={() => setShowAddMember(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <MemberPicker selected={picked} onChange={setPicked}
              excludeIds={(group.members || []).map(m => m.id)} showToast={showToast} />
            <button onClick={handleAddMembers} disabled={addingMembers}
              style={{ width: '100%', marginTop: 18, padding: '13px',
                       background: 'linear-gradient(135deg, var(--purple-dark), var(--purple-primary))',
                       color: 'white', border: 'none', borderRadius: 'var(--radius-sm)',
                       fontSize: 15, fontWeight: 700, cursor: addingMembers ? 'not-allowed' : 'pointer' }}>
              {addingMembers ? 'Adding…' : `Add ${picked.length || ''} member${picked.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
