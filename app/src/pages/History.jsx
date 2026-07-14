import React, { useEffect, useState } from 'react';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { settlementsAPI } from '../api/api';

const STATUS = {
  pending:   { label: 'Pending',   color: 'var(--orange)' },
  confirmed: { label: 'Confirmed', color: 'var(--green)' },
  disputed:  { label: 'Disputed',  color: 'var(--red)' },
};

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function History() {
  const { user, fmt, showToast } = useApp();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { const r = await settlementsAPI.list(); setRows(r.data); }
    catch { showToast('❌ Could not load history'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      <TopNav showBack title="Transaction History" />
      <div className="page-content fade-in">
        <div style={{margin:'16px 20px 8px',padding:'12px 16px',background:'rgba(124,92,252,0.1)',border:'1px solid rgba(124,92,252,0.25)',borderRadius:'var(--radius-sm)',fontSize:13,color:'var(--purple-light)',lineHeight:1.5}}>
          🧾 <strong>Your transactions</strong> — every payment you sent or received: who, when, how much, which group and the method used.
        </div>

        {loading ? (
          <div className="empty-state"><div className="empty-state-icon">⏳</div><div className="empty-state-title">Loading…</div></div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <div className="empty-state-title">No transactions yet</div>
            <div className="empty-state-text">Payments you make or receive will show up here.</div>
          </div>
        ) : (
          <div style={{padding:'8px 20px 20px',display:'grid',gap:10}}>
            {rows.map(t => {
              const outgoing = t.from_user_id === user?.id;
              const other = outgoing ? t.toName : t.fromName;
              const st = STATUS[t.status] || { label: t.status, color: 'var(--text-muted)' };
              return (
                <div key={t.id} className="settlement-card" style={{margin:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600}}>
                        {outgoing ? <>You paid <span style={{color:'var(--text-secondary)'}}>{other}</span></>
                                  : <><span style={{color:'var(--text-secondary)'}}>{other}</span> paid you</>}
                      </div>
                      <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3,lineHeight:1.7}}>
                        🕒 {fmtDate(t.created_at)}<br/>
                        📌 {t.groupName || 'No group'} · 💳 {t.payment_method || '—'}
                        {t.transaction_id ? <> · Txn {t.transaction_id}</> : null}
                      </div>
                    </div>
                    <div style={{textAlign:'right',whiteSpace:'nowrap'}}>
                      <div style={{fontSize:17,fontWeight:800,color: outgoing ? 'var(--red)' : 'var(--green)'}}>
                        {outgoing ? '−' : '+'}{fmt(t.amount)}
                      </div>
                      <div style={{fontSize:11,fontWeight:600,color:st.color,marginTop:2}}>{st.label}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
