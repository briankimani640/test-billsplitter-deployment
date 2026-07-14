import React, { useState } from 'react';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { settlementsAPI } from '../api/api';

function IOUCard({ person, owes, fmt, onSettle }) {
  const [open, setOpen] = useState(false);
  const [settling, setSettling] = useState(false);

  const handleSettle = async () => {
    setSettling(true);
    await onSettle(person);
    setSettling(false);
  };

  return (
    <div className="iou-person-card">
      <div className="iou-person-header" onClick={() => setOpen(p => !p)} style={{cursor:'pointer'}}>
        <div className="iou-person-avatar"
          style={{background:`linear-gradient(135deg, ${person.personColor || '#6366f1'}88, ${person.personColor || '#6366f1'})`}}>
          {person.personInitials}
        </div>
        <div>
          <div className="iou-person-name">{person.personName}</div>
          <div className="iou-person-group">📌 {person.groupName}</div>
        </div>
        <div className="iou-person-amount">
          <div className="iou-person-total" style={{color: owes ? 'var(--red)' : 'var(--green)'}}>
            {fmt(person.totalAmount)}
          </div>
          <div className="iou-person-label">{owes ? 'you owe' : 'owes you'}</div>
        </div>
        <span style={{color:'var(--text-muted)',marginLeft:6,fontSize:18}}>{open?'▲':'▼'}</span>
      </div>

      {open && (
        <>
          <div className="iou-breakdown">
            {(person.items || []).map((item, i) => (
              <div key={i} className="iou-breakdown-item">
                <span className="iou-breakdown-desc">{item.description}</span>
                <span className="iou-breakdown-amount" style={{color: owes ? 'var(--red)' : 'var(--green)'}}>
                  {owes ? '−' : '+'}{fmt(item.amount)}
                </span>
              </div>
            ))}
          </div>
          <button onClick={handleSettle} disabled={settling}
            style={{
              marginTop:12, width:'100%', padding:'10px',
              background: owes ? 'var(--red-bg)' : 'var(--green-bg)',
              color: owes ? 'var(--red)' : 'var(--green)',
              border: `1px solid ${owes ? 'var(--red)' : 'var(--green)'}`,
              borderRadius:'var(--radius-xs)', cursor: settling ? 'not-allowed' : 'pointer',
              fontSize:13, fontWeight:600,
            }}>
            {settling ? '⏳ Processing…' : owes ? `💸 Pay ${person.personName}` : `🔔 Remind ${person.personName}`}
          </button>
        </>
      )}
    </div>
  );
}

export default function IOUs() {
  const { ious, fmt, showToast, refreshIOUs, refreshSettlements } = useApp();
  const [tab, setTab] = useState('owe');

  const iOwe    = ious?.iOwe    || [];
  const owedToMe = ious?.owedToMe || [];
  const totalOwe  = iOwe.reduce((s, p) => s + parseFloat(p.totalAmount||0), 0);
  const totalOwed = owedToMe.reduce((s, p) => s + parseFloat(p.totalAmount||0), 0);

  const handleSettle = async (person) => {
    try {
      const s = await settlementsAPI.create({
        toUserId: person.personId,
        amount: parseFloat(person.totalAmount),
        groupId: person.groupId,
      });
      await settlementsAPI.markPaid(s.data.id);
      await refreshIOUs();
      await refreshSettlements();
      showToast('✅ Settlement recorded!');
    } catch {
      showToast('❌ Could not record settlement');
    }
  };

  const handleRemind = async (person) => {
    showToast(`🔔 Reminder sent to ${person.personName}`);
  };

  return (
    <div className="app-shell">
      <TopNav title="IOUs" />
      <div className="page-content fade-in">
        {/* Summary */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'16px 20px 8px'}}>
          <div style={{background:'var(--red-bg)',border:'1px solid var(--red)',borderRadius:'var(--radius)',padding:16}}>
            <div style={{fontSize:11,color:'var(--red)',marginBottom:6,fontWeight:600}}>YOU OWE</div>
            <div style={{fontSize:22,fontWeight:800,color:'var(--red)'}}>{fmt(totalOwe)}</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{iOwe.length} people</div>
          </div>
          <div style={{background:'var(--green-bg)',border:'1px solid var(--green)',borderRadius:'var(--radius)',padding:16}}>
            <div style={{fontSize:11,color:'var(--green)',marginBottom:6,fontWeight:600}}>OWED TO YOU</div>
            <div style={{fontSize:22,fontWeight:800,color:'var(--green)'}}>{fmt(totalOwed)}</div>
            <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>{owedToMe.length} people</div>
          </div>
        </div>

        <div className="iou-tabs">
          <div className={`iou-tab ${tab==='owe'?'active-owe':''}`} onClick={() => setTab('owe')}>
            I Owe ({iOwe.length})
          </div>
          <div className={`iou-tab ${tab==='owed'?'active-owed':''}`} onClick={() => setTab('owed')}>
            Owed to Me ({owedToMe.length})
          </div>
        </div>

        <div style={{marginTop:8}}>
          {tab === 'owe' && (
            iOwe.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">✅</div><div className="empty-state-title">You don't owe anyone!</div></div>
              : iOwe.map(p => <IOUCard key={p.personId + p.groupId} person={p} owes={true} fmt={fmt} onSettle={handleSettle} />)
          )}
          {tab === 'owed' && (
            owedToMe.length === 0
              ? <div className="empty-state"><div className="empty-state-icon">💸</div><div className="empty-state-title">Nobody owes you yet</div></div>
              : owedToMe.map(p => <IOUCard key={p.personId + p.groupId} person={p} owes={false} fmt={fmt} onSettle={handleRemind} />)
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
