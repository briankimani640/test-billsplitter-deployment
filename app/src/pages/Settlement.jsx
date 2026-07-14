import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { settlementsAPI, disputesAPI } from '../api/api';

const METHODS = ['M-Pesa', 'Equity', 'KCB', 'Cash', 'Bank transfer', 'Other'];
const DISPUTE_REASONS = [
  { key: 'money_not_received',  label: 'Money not received' },
  { key: 'fake_transaction_id', label: 'Fake transaction ID' },
  { key: 'incomplete_amount',   label: 'Incomplete amount' },
  { key: 'other',               label: 'Others' },
];

const Avatar = ({ text, tone }) => (
  <div style={{width:44,height:44,borderRadius:'50%',
    background: tone==='green' ? 'rgba(34,197,94,0.15)' : 'rgba(124,92,252,0.2)',
    color: tone==='green' ? 'var(--green)' : 'var(--purple-primary)',
    display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14,margin:'0 auto 4px'}}>
    {text}
  </div>
);

const Arrow = ({ amount, fmt }) => (
  <div style={{textAlign:'center'}}>
    <svg width="60" height="16" viewBox="0 0 60 16">
      <path d="M4 8 H52 M46 3 l10 5 -10 5" stroke="var(--red)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <div style={{fontSize:18,fontWeight:800,color:'var(--red)',marginTop:2}}>{fmt(amount)}</div>
  </div>
);

// ---- A debt the current user owes: record a (partial) payment ----
function OweCard({ s, fmt, onPaid }) {
  const [open, setOpen]   = useState(false);
  const [amount, setAmt]  = useState(String(s.amount));
  const [method, setMeth] = useState('M-Pesa');
  const [txn, setTxn]     = useState('');
  const [busy, setBusy]   = useState(false);
  const { showToast } = useApp();

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)      return showToast('Enter a valid amount');
    if (amt > Number(s.amount) + 0.01) return showToast(`You only owe ${fmt(s.amount)}`);
    setBusy(true);
    try {
      await settlementsAPI.create({
        toUserId: s.toUserId, amount: amt, groupId: s.groupId,
        paymentMethod: method, transactionId: txn.trim() || null,
      });
      showToast('✅ Payment recorded — awaiting confirmation');
      setOpen(false); setTxn('');
      await onPaid();
    } catch (e) {
      showToast('❌ ' + (e.response?.data?.error || 'Could not record payment'));
    } finally { setBusy(false); }
  };

  const inp = {width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border)',
    borderRadius:'var(--radius-xs)',color:'var(--text-primary)',fontSize:14,outline:'none'};

  return (
    <div className="settlement-card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-around',marginBottom:12}}>
        <div style={{textAlign:'center'}}><Avatar text={s.fromInitials}/><div style={{fontSize:11,color:'var(--text-muted)'}}>{s.fromName}</div></div>
        <Arrow amount={s.amount} fmt={fmt}/>
        <div style={{textAlign:'center'}}><Avatar text={s.toInitials} tone="green"/><div style={{fontSize:11,color:'var(--text-muted)'}}>{s.toName}</div></div>
      </div>

      <div className="settlement-context">
        <span>📌 {s.groupName || 'Group'} · <span style={{color:'var(--text-secondary)'}}>{fmt(s.amount)} left</span></span>
        {!open ? (
          <button onClick={() => { setOpen(true); setAmt(String(s.amount)); }}
            style={{background:'var(--green-bg)',color:'var(--green)',border:'1px solid var(--green)',borderRadius:20,padding:'6px 14px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            Record payment
          </button>
        ) : (
          <button onClick={() => setOpen(false)}
            style={{background:'var(--bg-card-alt)',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:20,padding:'6px 14px',fontSize:13,cursor:'pointer'}}>
            Close
          </button>
        )}
      </div>

      {open && (
        <div style={{marginTop:12,display:'grid',gap:10}}>
          <div>
            <label style={{fontSize:12,color:'var(--text-muted)'}}>Amount (you can pay part of it)</label>
            <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
              <span style={{fontSize:13,color:'var(--text-muted)'}}>KSh</span>
              <input style={inp} type="number" min="0" max={s.amount} value={amount} onChange={e=>setAmt(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{fontSize:12,color:'var(--text-muted)'}}>Payment method</label>
            <select style={{...inp,appearance:'none',marginTop:4}} value={method} onChange={e=>setMeth(e.target.value)}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:12,color:'var(--text-muted)'}}>Transaction ID</label>
            <input style={{...inp,marginTop:4}} placeholder="e.g. SGH4X8K2LP" value={txn} onChange={e=>setTxn(e.target.value)} />
          </div>
          <button onClick={submit} disabled={busy}
            style={{background:'var(--purple-primary)',color:'#fff',border:'none',borderRadius:'var(--radius-sm)',padding:'11px',fontSize:14,fontWeight:600,cursor:busy?'not-allowed':'pointer',opacity:busy?0.6:1}}>
            {busy ? '⏳ Recording…' : 'Send payment for confirmation'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---- A payment recorded toward me: confirm or dispute ----
function ConfirmCard({ p, fmt, onDone }) {
  const [busy, setBusy]       = useState(false);
  const [disputing, setDisp]  = useState(false);
  const [reason, setReason]   = useState('money_not_received');
  const [note, setNote]       = useState('');
  const { showToast } = useApp();

  const confirm = async () => {
    setBusy(true);
    try { await settlementsAPI.confirm(p.id); showToast('✅ Payment confirmed'); await onDone(); }
    catch (e) { showToast('❌ ' + (e.response?.data?.error || 'Could not confirm')); }
    finally { setBusy(false); }
  };
  const raise = async () => {
    setBusy(true);
    try {
      await disputesAPI.create({ settlementId: p.id, reason, note: note.trim() || null });
      showToast('⚠️ Dispute raised');
      setDisp(false); setNote('');
      await onDone();
    } catch (e) { showToast('❌ ' + (e.response?.data?.error || 'Could not raise dispute')); }
    finally { setBusy(false); }
  };

  return (
    <div className="settlement-card" style={{border:'1px solid rgba(124,92,252,0.35)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-around',marginBottom:10}}>
        <div style={{textAlign:'center'}}><Avatar text={p.fromInitials}/><div style={{fontSize:11,color:'var(--text-muted)'}}>{p.fromName}</div></div>
        <Arrow amount={p.amount} fmt={fmt}/>
        <div style={{textAlign:'center'}}><Avatar text={p.toInitials} tone="green"/><div style={{fontSize:11,color:'var(--text-muted)'}}>You</div></div>
      </div>

      <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.7,padding:'8px 2px',borderTop:'1px dashed var(--border)'}}>
        📌 {p.groupName || 'Group'}<br/>
        💳 {p.payment_method || 'Unknown method'}
        {p.transaction_id ? <> · <span style={{color:'var(--text-secondary)'}}>Txn {p.transaction_id}</span></> : null}
      </div>

      {!disputing ? (
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={confirm} disabled={busy}
            style={{background:'var(--green)',color:'#fff',border:'none',borderRadius:20,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:busy?'not-allowed':'pointer'}}>
            {busy ? '⏳…' : 'Confirm ✓'}
          </button>
          <button onClick={() => setDisp(true)} disabled={busy}
            style={{background:'var(--red-bg)',color:'var(--red)',border:'1px solid var(--red)',borderRadius:20,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            Dispute ⚠
          </button>
        </div>
      ) : (
        <div style={{display:'grid',gap:10,marginTop:6}}>
          <div style={{fontSize:12,color:'var(--text-muted)',fontWeight:600}}>Why are you disputing this payment?</div>
          <div style={{display:'grid',gap:6}}>
            {DISPUTE_REASONS.map(r => (
              <label key={r.key} style={{display:'flex',alignItems:'center',gap:8,fontSize:14,cursor:'pointer',
                padding:'9px 12px',borderRadius:'var(--radius-xs)',border:'1px solid',
                borderColor: reason===r.key ? 'var(--red)' : 'var(--border)',
                background: reason===r.key ? 'var(--red-bg)' : 'var(--bg-input)',
                color: reason===r.key ? 'var(--red)' : 'var(--text-secondary)'}}>
                <input type="radio" name={`r-${p.id}`} checked={reason===r.key} onChange={()=>setReason(r.key)} style={{accentColor:'var(--red)'}}/>
                {r.label}
              </label>
            ))}
          </div>
          <textarea rows={2} placeholder="Add a note (optional)" value={note} onChange={e=>setNote(e.target.value)}
            style={{width:'100%',padding:'10px 12px',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:'var(--radius-xs)',color:'var(--text-primary)',fontSize:13,outline:'none',resize:'vertical'}}/>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button onClick={()=>setDisp(false)} style={{background:'var(--bg-card-alt)',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:20,padding:'7px 16px',fontSize:13,cursor:'pointer'}}>Cancel</button>
            <button onClick={raise} disabled={busy}
              style={{background:'var(--red)',color:'#fff',border:'none',borderRadius:20,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:busy?'not-allowed':'pointer'}}>
              {busy ? '⏳…' : 'Submit dispute'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settlement() {
  const { settlements, pending, disputes, fmt, showToast, refreshMoney } = useApp();
  const navigate = useNavigate();
  const [prevCount, setPrevCount] = useState(pending?.toConfirm?.length || 0);

  // Auto-refresh: on mount, when the tab regains focus, and every 15s.
  useEffect(() => {
    refreshMoney();
    const onFocus = () => refreshMoney();
    window.addEventListener('focus', onFocus);
    const id = setInterval(refreshMoney, 15000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pop a toast when a new payment arrives for confirmation.
  useEffect(() => {
    const n = pending?.toConfirm?.length || 0;
    if (n > prevCount) showToast('🔔 New payment awaiting your confirmation');
    setPrevCount(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const iOwe   = settlements.filter(s => s.direction === 'owe');
  const toConfirm = pending?.toConfirm || [];
  const awaiting  = pending?.awaiting  || [];
  const openDisputes = (disputes || []).filter(d => d.status === 'open');
  const nothing = iOwe.length === 0 && toConfirm.length === 0 && awaiting.length === 0;

  return (
    <div className="app-shell">
      <TopNav title="Settle Up" />
      <div className="page-content fade-in">
        <div style={{margin:'16px 20px 8px',padding:'12px 16px',background:'rgba(124,92,252,0.1)',border:'1px solid rgba(124,92,252,0.25)',borderRadius:'var(--radius-sm)',fontSize:13,color:'var(--purple-light)',lineHeight:1.5}}>
          ✨ <strong>Simplified settlements</strong> — pay in full or in parts; the person you paid confirms each one.
        </div>

        {openDisputes.length > 0 && (
          <div onClick={() => navigate('/disputes')}
            style={{margin:'0 20px 8px',padding:'12px 16px',background:'var(--red-bg)',border:'1px solid var(--red)',borderRadius:'var(--radius-sm)',fontSize:13,color:'var(--red)',cursor:'pointer'}}>
            ⚖️ {openDisputes.length} open dispute{openDisputes.length!==1?'s':''} — tap to review
          </div>
        )}

        {/* Payments awaiting my confirmation */}
        {toConfirm.length > 0 && (
          <>
            <div className="settle-section-label">{toConfirm.length} payment{toConfirm.length!==1?'s':''} to confirm</div>
            {toConfirm.map(p => <ConfirmCard key={p.id} p={p} fmt={fmt} onDone={refreshMoney} />)}
          </>
        )}

        {/* Debts I owe */}
        {iOwe.length > 0 && (
          <>
            <div className="settle-section-label">{iOwe.length} payment{iOwe.length!==1?'s':''} you need to make</div>
            {iOwe.map((s, i) => <OweCard key={`${s.toUserId}-${s.groupId}-${i}`} s={s} fmt={fmt} onPaid={refreshMoney} />)}
          </>
        )}

        {/* My payments awaiting the other side */}
        {awaiting.length > 0 && (
          <>
            <div className="settle-section-label">Awaiting confirmation</div>
            {awaiting.map(p => (
              <div key={p.id} className="settlement-card" style={{opacity:0.9}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:13}}>
                    You paid <strong>{p.toName}</strong> {fmt(p.amount)}
                    <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                      📌 {p.groupName || 'Group'} · {p.payment_method || '—'}{p.transaction_id?` · Txn ${p.transaction_id}`:''}
                    </div>
                  </div>
                  <span style={{fontSize:12,color:'var(--orange)',fontWeight:600,whiteSpace:'nowrap'}}>⏳ Pending</span>
                </div>
              </div>
            ))}
          </>
        )}

        {nothing && (
          <div className="empty-state">
            <div className="empty-state-icon">🎉</div>
            <div className="empty-state-title">All settled up!</div>
            <div className="empty-state-text">No outstanding payments. You're all good!</div>
          </div>
        )}

        {/* Pay via */}
        <div style={{padding:'0 20px',marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:12,marginTop:16}}>Pay via</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[
              {name:'M-Pesa', emoji:'📱', url:'https://play.google.com/store/search?q=M-PESA%20by%20Safaricom&c=apps'},
              {name:'Equity', emoji:'🏦', url:'https://play.google.com/store/search?q=Equity%20Mobile&c=apps'},
              {name:'KCB',    emoji:'💳', url:'https://play.google.com/store/search?q=KCB%20Mobile&c=apps'},
            ].map(p => (
              <button key={p.name} onClick={() => { window.open(p.url,'_blank','noopener,noreferrer'); showToast(`Opening ${p.name} download page…`); }}
                style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'12px 8px',display:'flex',flexDirection:'column',alignItems:'center',gap:6,cursor:'pointer',color:'var(--text-secondary)',fontSize:12,fontWeight:500}}>
                <span style={{fontSize:22}}>{p.emoji}</span>{p.name}
                <span style={{fontSize:10,color:'var(--text-muted)'}}>Get the app ↗</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
