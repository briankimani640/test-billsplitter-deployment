import React, { useEffect } from 'react';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { disputesAPI } from '../api/api';

function DisputeCard({ d, fmt, meId, onDone }) {
  const { showToast } = useApp();
  const iRaised = d.raised_by === meId;
  const resolved = d.status === 'resolved';

  const resolve = async () => {
    try { await disputesAPI.resolve(d.id); showToast('✅ Dispute resolved'); await onDone(); }
    catch (e) { showToast('❌ ' + (e.response?.data?.error || 'Could not resolve')); }
  };

  return (
    <div className="settlement-card" style={{border:`1px solid ${resolved ? 'var(--border)' : 'var(--red)'}`}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,color:resolved?'var(--text-secondary)':'var(--red)'}}>
            {resolved ? '✓ Resolved' : '⚖️ Open dispute'}
          </div>
          <div style={{fontSize:13,color:'var(--text-secondary)',marginTop:4}}>
            <strong>{d.reasonLabel}</strong>
          </div>
          {d.note && <div style={{fontSize:13,color:'var(--text-muted)',marginTop:2,fontStyle:'italic'}}>“{d.note}”</div>}
        </div>
        <div style={{fontSize:16,fontWeight:800,color:'var(--red)',whiteSpace:'nowrap'}}>{fmt(d.amount || 0)}</div>
      </div>

      <div style={{fontSize:12,color:'var(--text-muted)',lineHeight:1.7,marginTop:10,paddingTop:10,borderTop:'1px dashed var(--border)'}}>
        📌 {d.groupName || 'Group'}<br/>
        {iRaised ? <>You disputed <strong>{d.againstName}</strong>’s payment</> : <><strong>{d.raisedByName}</strong> disputed your payment</>}
        {d.transactionId ? <> · Txn {d.transactionId}</> : null}
      </div>

      <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
        {resolved ? (
          <span style={{fontSize:12,color:'var(--green)',fontWeight:600}}>Closed</span>
        ) : iRaised ? (
          <button onClick={resolve}
            style={{background:'var(--green)',color:'#fff',border:'none',borderRadius:20,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            Resolve ✓
          </button>
        ) : (
          <span style={{fontSize:12,color:'var(--text-muted)'}}>Only {d.raisedByName} can resolve this</span>
        )}
      </div>
    </div>
  );
}

export default function Disputes() {
  const { disputes, user, fmt, refreshDisputes } = useApp();

  useEffect(() => {
    refreshDisputes();
    const onFocus = () => refreshDisputes();
    window.addEventListener('focus', onFocus);
    const id = setInterval(refreshDisputes, 15000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (disputes || []).filter(d => d.status === 'open');
  const closed = (disputes || []).filter(d => d.status !== 'open');

  return (
    <div className="app-shell">
      <TopNav showBack title="Disputes" />
      <div className="page-content fade-in">
        <div style={{margin:'16px 20px 8px',padding:'12px 16px',background:'var(--red-bg)',border:'1px solid rgba(214,69,69,0.35)',borderRadius:'var(--radius-sm)',fontSize:13,color:'var(--red)',lineHeight:1.5}}>
          ⚖️ <strong>Disputes</strong> — raised when two members disagree on a payment (money not received, fake transaction ID, incomplete amount). Only the person who opened a dispute can resolve it.
        </div>

        {disputes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤝</div>
            <div className="empty-state-title">No disputes</div>
            <div className="empty-state-text">Payments are being confirmed smoothly.</div>
          </div>
        ) : (
          <>
            {open.length > 0 && <div className="settle-section-label">{open.length} open</div>}
            {open.map(d => <DisputeCard key={d.id} d={d} fmt={fmt} meId={user?.id} onDone={refreshDisputes} />)}
            {closed.length > 0 && <div className="settle-section-label">Resolved</div>}
            {closed.map(d => <DisputeCard key={d.id} d={d} fmt={fmt} meId={user?.id} onDone={refreshDisputes} />)}
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
