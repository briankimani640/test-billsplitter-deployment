import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { expensesAPI, ocrAPI } from '../api/api';
import { groupsAPI } from '../api/api';

const CATEGORIES = [
  { emoji:'🍽️', name:'Food' },{ emoji:'🏠', name:'Housing' },{ emoji:'🚌', name:'Transport' },
  { emoji:'🎭', name:'Entertainment' },{ emoji:'⚡', name:'Utilities' },{ emoji:'🛍️', name:'Shopping' },
  { emoji:'💊', name:'Health' },{ emoji:'✈️', name:'Travel' },{ emoji:'📱', name:'Technology' },{ emoji:'📦', name:'Other' },
];

export default function AddExpense() {
  const { groups, user, fmt, showToast, refreshGroups } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const preselectedGroup = location.state?.groupId || (groups[0]?.id ?? '');
  const [selectedGroup, setSelectedGroup] = useState(groups.find(g => g.id === preselectedGroup) || groups[0]);

  const [desc,       setDesc]       = useState('');
  const [amount,     setAmount]     = useState('');
  const [groupId,    setGroupId]    = useState(preselectedGroup);
  const [paidBy,     setPaidBy]     = useState(user?.id || '');
  const [splitType,  setSplit]      = useState('equal');
  const [category,   setCategory]   = useState('Food');
  const [step,       setStep]       = useState(1);
  const [error,      setError]      = useState('');
  const [submitting, setSub]        = useState(false);
  const [receipt,    setReceipt]    = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  const members = selectedGroup?.members || [];
  const [checkedMembers, setChecked] = useState(
    () => members.reduce((a, m) => ({ ...a, [m.id]: true }), {})
  );

  // Custom split state
  const [splitAmounts,  setSplitAmounts]  = useState({});   // exact  → { memberId: "123.00" }
  const [splitPercents, setSplitPercents] = useState({});   // percent → { memberId: "25.0" }

  const totalAmt     = parseFloat(amount) || 0;
  const checkedIds   = Object.entries(checkedMembers).filter(([,v]) => v).map(([k]) => k);
  const checkedCount = checkedIds.length || 1;
  const perPerson    = totalAmt / checkedCount;

  // Even-split helpers — parts are guaranteed to sum EXACTLY to the whole
  const evenAmounts = (ids, total) => {
    const n = ids.length; const out = {};
    if (!n) return out;
    const base = Math.floor((total / n) * 100) / 100;
    let acc = 0;
    ids.forEach((id, i) => {
      const v = (i === n - 1) ? Math.round((total - acc) * 100) / 100 : base;
      acc += base;
      out[id] = total ? v.toFixed(2) : '';
    });
    return out;
  };
  const evenPercents = (ids) => {
    const n = ids.length; const out = {};
    if (!n) return out;
    const base = Math.floor((100 / n) * 10) / 10;
    let acc = 0;
    ids.forEach((id, i) => {
      const v = (i === n - 1) ? Math.round((100 - acc) * 10) / 10 : base;
      acc += base;
      out[id] = v.toFixed(1);
    });
    return out;
  };
  const applyEven = () => {
    if (splitType === 'exact')   setSplitAmounts(evenAmounts(checkedIds, totalAmt));
    if (splitType === 'percent') setSplitPercents(evenPercents(checkedIds));
  };

  // Seed custom split defaults — only fills blanks, keeps anything the user typed
  useEffect(() => {
    if (splitType === 'exact') {
      setSplitAmounts(prev => {
        const anyBlank = checkedIds.some(id => prev[id] === undefined || prev[id] === '');
        if (!anyBlank) { const next = {}; checkedIds.forEach(id => { next[id] = prev[id]; }); return next; }
        return evenAmounts(checkedIds, totalAmt);
      });
    } else if (splitType === 'percent') {
      setSplitPercents(prev => {
        const anyBlank = checkedIds.some(id => prev[id] === undefined || prev[id] === '');
        if (!anyBlank) { const next = {}; checkedIds.forEach(id => { next[id] = prev[id]; }); return next; }
        return evenPercents(checkedIds);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitType, amount, JSON.stringify(checkedMembers)]);

  // Totals for validation
  const allocated     = checkedIds.reduce((s, id) => s + (parseFloat(splitAmounts[id])  || 0), 0);
  const allocatedPct  = checkedIds.reduce((s, id) => s + (parseFloat(splitPercents[id]) || 0), 0);
  const remaining     = totalAmt - allocated;
  const exactBalanced   = Math.abs(remaining) <= 0.01 && totalAmt > 0;
  const percentBalanced = Math.abs(100 - allocatedPct) <= 0.1;
  const canSave = !submitting
    && checkedIds.length > 0
    && (splitType === 'equal'
        || (splitType === 'exact'   && exactBalanced)
        || (splitType === 'percent' && percentBalanced));

  // Make sure a group is selected once groups have loaded
  useEffect(() => {
    if (!groupId && groups.length) {
      setGroupId(location.state?.groupId || groups[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  // Load the FULL group (with members) whenever the selected group changes.
  // The groups list only carries a member count, so this is what populates
  // the payer list and the split rows — without it Save stays disabled.
  useEffect(() => {
    if (!groupId) { setSelectedGroup(null); return; }
    let active = true;
    groupsAPI.get(groupId)
      .then(res => {
        if (!active) return;
        setSelectedGroup(res.data);
        const nm = res.data.members || [];
        setChecked(nm.reduce((a, m) => ({ ...a, [m.id]: true }), {}));
        setSplitAmounts({}); setSplitPercents({});
        setPaidBy(nm.find(m => m.id === user?.id) ? user.id : (nm[0]?.id || ''));
      })
      .catch(() => { if (active) showToast('Could not load group members'); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const handleReceipt = async (file) => {
    setReceipt(file);
    setOcrLoading(true);
    try {
      const res = await ocrAPI.processReceipt(file);
      const { amount: a, merchant, category: c } = res.data;
      if (a)        setAmount(String(a));
      if (merchant) setDesc(merchant);
      if (c)        setCategory(c);
      showToast('📷 Receipt scanned!');
    } catch {
      showToast('📷 Could not read receipt — fill in manually');
    } finally {
      setOcrLoading(false);
    }
  };

  const validateStep1 = () => {
    if (!desc.trim())      { setError('Please enter a description.'); return false; }
    if (!amount || totalAmt <= 0) { setError('Please enter a valid amount.'); return false; }
    if (!groupId)          { setError('Please select a group.'); return false; }
    if (!paidBy)           { setError('Please choose who paid.'); return false; }
    setError(''); return true;
  };

  const handleSubmit = async () => {
    // Guard: custom splits must reconcile
    if (splitType === 'exact' && !exactBalanced) {
      showToast(`⚠️ Split must total ${fmt(totalAmt)} — ${remaining >= 0 ? fmt(remaining)+' left' : fmt(Math.abs(remaining))+' over'}`);
      return;
    }
    if (splitType === 'percent' && !percentBalanced) {
      showToast(`⚠️ Percentages must total 100% (currently ${allocatedPct.toFixed(1)}%)`);
      return;
    }

    setSub(true);
    try {
      let splits;
      if (splitType === 'equal') {
        splits = checkedIds.map(uid => ({ userId: uid, amount: parseFloat(perPerson.toFixed(2)) }));
      } else if (splitType === 'exact') {
        splits = checkedIds.map(uid => ({ userId: uid, amount: parseFloat(parseFloat(splitAmounts[uid] || 0).toFixed(2)) }));
      } else {
        splits = checkedIds.map(uid => ({ userId: uid, amount: parseFloat(parseFloat(splitPercents[uid] || 0).toFixed(2)) }));
      }

      await expensesAPI.create({
        groupId,
        description: desc,
        amount: totalAmt,
        paidBy,
        category,
        emoji: CATEGORIES.find(c => c.name === category)?.emoji || '📦',
        splitType,
        splits,
        date: new Date().toISOString().slice(0, 10),
        receipt,
      });

      await refreshGroups();
      showToast('✅ Expense added!');
      navigate(-1);
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Failed to add expense'));
    } finally {
      setSub(false);
    }
  };

  const splitInputStyle = {
    width: 92, textAlign: 'right', background:'var(--bg-input)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-xs)', color:'var(--text-primary)', fontSize:13, padding:'6px 8px', outline:'none',
  };

  return (
    <div className="app-shell">
      <TopNav showBack title={step === 1 ? 'Add Expense' : 'Split Details'} />
      <div className="page-content fade-in">
        {/* Steps */}
        <div style={{ display:'flex', gap:6, padding:'12px 20px 20px' }}>
          {[1,2].map(s => (
            <div key={s} style={{ flex: s===1?2:1, height:4, borderRadius:2,
              background: step>=s ? 'var(--purple-primary)' : 'var(--border)', transition:'background 0.3s' }} />
          ))}
        </div>

        {step === 1 && (
          <>
            {/* Receipt OCR */}
            <div className="form-card">
              <div className="form-card-title">📷 Scan Receipt (optional)</div>
              <label style={{
                display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                padding:'14px', border:'2px dashed var(--border)', borderRadius:'var(--radius-sm)',
                cursor:'pointer', color:'var(--text-muted)', fontSize:14, fontWeight:500,
                background: ocrLoading ? 'rgba(124,92,252,0.05)' : 'var(--bg-input)',
              }}>
                <input type="file" accept="image/*" style={{display:'none'}}
                  onChange={e => e.target.files[0] && handleReceipt(e.target.files[0])} />
                {ocrLoading ? '🔍 Reading receipt…' : receipt ? `✅ ${receipt.name}` : '📎 Upload receipt image'}
              </label>
            </div>

            {/* Amount */}
            <div className="form-card">
              <div className="form-card-title">How much?</div>
              <div className="input-with-prefix">
                <span className="input-prefix input-prefix-lg">KSh</span>
                <input className="form-input form-input-lg" type="number" min="0"
                  placeholder="0" value={amount} onChange={e => setAmount(e.target.value)}
                  style={{paddingLeft:80}} />
              </div>
            </div>

            {/* Details */}
            <div className="form-card">
              <div className="form-card-title">Details</div>
              <div className="form-group">
                <label className="form-label">What's it for?</label>
                <input className="form-input" placeholder="e.g. Dinner at Java"
                  value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Group</label>
                <select className="form-input" value={groupId}
                  onChange={e => setGroupId(e.target.value)} style={{appearance:'none'}}>
                  <option value="">Select group…</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.icon} {g.name}</option>)}
                </select>
              </div>

              {/* Who paid — choose from ALL members */}
              <div className="form-group">
                <label className="form-label">Who paid?</label>
                {members.length === 0 ? (
                  <div style={{fontSize:13,color:'var(--text-muted)'}}>Select a group to choose the payer.</div>
                ) : (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    {members.map(m => (
                      <div key={m.id}
                        onClick={() => setPaidBy(m.id)}
                        style={{
                          display:'flex',alignItems:'center',gap:8,padding:'10px 12px',cursor:'pointer',
                          borderRadius:'var(--radius-sm)',border:'1px solid',
                          borderColor: paidBy===m.id ? 'var(--purple-primary)' : 'var(--border)',
                          background: paidBy===m.id ? 'rgba(124,92,252,0.15)' : 'var(--bg-input)',
                          color: paidBy===m.id ? 'var(--purple-light)' : 'var(--text-secondary)',
                        }}>
                        <div className="member-avatar" style={{width:26,height:26,fontSize:11}}>{m.initials || m.name?.[0]}</div>
                        <span style={{fontSize:13,fontWeight:paidBy===m.id?700:500}}>
                          {m.id === user?.id ? 'You' : (m.name?.split(' ')[0] || m.name)}
                        </span>
                        {paidBy===m.id && <span style={{marginLeft:'auto',color:'var(--purple-primary)'}}>✓</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="form-card">
              <div className="form-card-title">Category</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {CATEGORIES.map(c => (
                  <button key={c.name} onClick={() => setCategory(c.name)}
                    style={{
                      padding:'7px 14px', borderRadius:20, border:'1px solid',
                      borderColor: category===c.name ? 'var(--purple-primary)' : 'var(--border)',
                      background: category===c.name ? 'rgba(124,92,252,0.15)' : 'var(--bg-input)',
                      color: category===c.name ? 'var(--purple-primary)' : 'var(--text-secondary)',
                      fontSize:13, cursor:'pointer', transition:'var(--transition)',
                    }}>{c.emoji} {c.name}</button>
                ))}
              </div>
            </div>

            {error && <div style={{margin:'0 20px 12px',padding:'10px 14px',background:'var(--red-bg)',borderRadius:'var(--radius-sm)',color:'var(--red)',fontSize:13}}>⚠️ {error}</div>}

            <div className="px-20 mb-20">
              <button className="btn btn-primary" onClick={() => { if (validateStep1()) setStep(2); }}>
                Next: Split Details →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="form-card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700}}>{desc}</div>
                  <div style={{fontSize:13,color:'var(--text-muted)'}}>{selectedGroup?.name}</div>
                </div>
                <div style={{fontSize:24,fontWeight:800,color:'var(--purple-light)'}}>{fmt(totalAmt)}</div>
              </div>
            </div>

            <div className="form-card">
              <div className="form-card-title">Split type</div>
              <div className="split-tabs">
                {[['equal','⚖️ Equal'],['exact','💰 Custom'],['percent','% Percent']].map(([v,l]) => (
                  <div key={v} className={`split-tab ${splitType===v?'active':''}`} onClick={() => setSplit(v)}>{l}</div>
                ))}
              </div>

              {splitType !== 'equal' && (
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,margin:'10px 2px 4px'}}>
                  <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
                    {splitType === 'exact'
                      ? 'Enter what each person contributes — the total must match the bill.'
                      : 'Enter each person’s percentage — must add up to 100%.'}
                  </p>
                  <button type="button" onClick={applyEven}
                    style={{flex:'none',fontSize:12,fontWeight:600,color:'var(--purple-light)',background:'rgba(124,92,252,0.12)',
                            border:'1px solid var(--purple-primary)',borderRadius:999,padding:'6px 12px',cursor:'pointer'}}>
                    Split evenly
                  </button>
                </div>
              )}

              {members.map(m => {
                const checked = !!checkedMembers[m.id];
                return (
                  <div key={m.id} className="split-member-row">
                    <div className={`split-checkbox ${checked?'checked':''}`}
                      onClick={() => setChecked(p => ({...p,[m.id]:!p[m.id]}))}>
                      {checked && '✓'}
                    </div>
                    <div className="member-avatar" style={{width:32,height:32,fontSize:12}}>{m.initials}</div>
                    <div className="split-member-name">{m.name} {m.id===user?.id?'(You)':''}</div>

                    {/* Right side depends on split type */}
                    {splitType === 'equal' && (
                      <div className="split-member-share" style={{color:checked?'var(--text-primary)':'var(--text-muted)'}}>
                        {checked ? fmt(perPerson) : '—'}
                      </div>
                    )}
                    {splitType === 'exact' && (
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:12,color:'var(--text-muted)'}}>KSh</span>
                        <input type="number" min="0" step="0.01" disabled={!checked}
                          style={{...splitInputStyle, opacity: checked?1:0.4}}
                          value={checked ? (splitAmounts[m.id] ?? '') : ''}
                          onChange={e => setSplitAmounts(p => ({...p,[m.id]:e.target.value}))} />
                      </div>
                    )}
                    {splitType === 'percent' && (
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <input type="number" min="0" max="100" step="0.1" disabled={!checked}
                          style={{...splitInputStyle, width:64, opacity: checked?1:0.4}}
                          value={checked ? (splitPercents[m.id] ?? '') : ''}
                          onChange={e => setSplitPercents(p => ({...p,[m.id]:e.target.value}))} />
                        <span style={{fontSize:12,color:'var(--text-muted)'}}>%</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Live reconciliation banner */}
              {totalAmt > 0 && splitType === 'equal' && (
                <div style={{marginTop:14,padding:'10px 14px',background:'rgba(124,92,252,0.1)',borderRadius:'var(--radius-sm)',fontSize:13,color:'var(--purple-light)'}}>
                  Each person: <strong>{fmt(perPerson)}</strong> · {checkedCount} of {members.length} members
                </div>
              )}
              {splitType === 'exact' && (
                <div style={{marginTop:14,padding:'10px 14px',borderRadius:'var(--radius-sm)',fontSize:13,
                  background: exactBalanced ? 'var(--green-bg)' : 'var(--red-bg)',
                  color: exactBalanced ? 'var(--green)' : 'var(--red)'}}>
                  Allocated <strong>{fmt(allocated)}</strong> of <strong>{fmt(totalAmt)}</strong>
                  {exactBalanced ? ' — balanced ✓' : (remaining >= 0 ? ` — ${fmt(remaining)} left` : ` — ${fmt(Math.abs(remaining))} over`)}
                </div>
              )}
              {splitType === 'percent' && (
                <div style={{marginTop:14,padding:'10px 14px',borderRadius:'var(--radius-sm)',fontSize:13,
                  background: percentBalanced ? 'var(--green-bg)' : 'var(--red-bg)',
                  color: percentBalanced ? 'var(--green)' : 'var(--red)'}}>
                  Total <strong>{allocatedPct.toFixed(1)}%</strong> {percentBalanced ? '— balanced ✓' : 'of 100%'}
                </div>
              )}
            </div>

            <div className="px-20" style={{display:'flex',flexDirection:'column',gap:10,marginBottom:20}}>
              <button className="btn btn-primary" disabled={!canSave} style={{opacity:canSave?1:0.55}} onClick={handleSubmit}>
                {submitting ? '⏳ Saving…' : '✅ Save Expense'}
              </button>
              <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
