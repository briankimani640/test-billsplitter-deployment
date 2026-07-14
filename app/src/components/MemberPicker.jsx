import React, { useState, useEffect, useRef } from 'react';
import { usersAPI } from '../api/api';
import { contactsSupported, pickContacts, normalizePhone } from '../utils/contacts';

// Lets the user find people by search OR by importing phone contacts.
// `selected` is an array of user objects; `onChange(next)` reports changes.
export default function MemberPicker({ selected, onChange, excludeIds = [], showToast }) {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy]       = useState(false);
  const debounce = useRef(null);

  const selectedIds = new Set(selected.map(s => s.id));
  const blocked     = new Set([...excludeIds, ...selectedIds]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await usersAPI.searchUsers(q.trim());
        setResults(res.data.filter(u => !blocked.has(u.id)));
      } catch { /* ignore */ }
    }, 300);
    return () => debounce.current && clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, selected]);

  const add = (user) => {
    if (selectedIds.has(user.id)) return;
    onChange([...selected, user]);
    setQ(''); setResults([]);
  };
  const remove = (id) => onChange(selected.filter(s => s.id !== id));

  const importFromContacts = async () => {
    setBusy(true);
    try {
      const contacts = await pickContacts({ multiple: true });
      const phones = contacts.flatMap(c => c.phones.map(normalizePhone)).filter(p => p.length === 10);
      if (!phones.length) { showToast?.('No phone numbers found in selection'); return; }

      const res = await usersAPI.lookupContacts(phones);
      const matches = res.data.filter(u => !blocked.has(u.id));
      if (!matches.length) {
        showToast?.('None of those contacts use SplitKesh yet');
        return;
      }
      const merged = [...selected];
      matches.forEach(m => { if (!merged.find(x => x.id === m.id)) merged.push(m); });
      onChange(merged);
      showToast?.(`Added ${matches.length} contact${matches.length > 1 ? 's' : ''}`);
    } catch (err) {
      if (err.code === 'UNSUPPORTED') {
        showToast?.('Contacts not supported here — search by @username instead');
      } else {
        showToast?.('Could not read contacts');
      }
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
    fontFamily: 'Inter, sans-serif', fontSize: 14, padding: '11px 14px',
    outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {selected.map(s => (
            <span key={s.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(124,92,252,0.15)', color: 'var(--purple-light)',
              borderRadius: 16, padding: '5px 10px', fontSize: 13,
            }}>
              {s.name}
              <span onClick={() => remove(s.id)} style={{ cursor: 'pointer', fontWeight: 700 }}>×</span>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input style={inputStyle} placeholder="Search by @username"
          value={q} onChange={e => setQ(e.target.value)} />
        {contactsSupported() && (
          <button type="button" onClick={importFromContacts} disabled={busy}
            title="Import from contacts"
            style={{ whiteSpace: 'nowrap', padding: '0 12px', background: 'var(--bg-card-alt)',
                     border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                     color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer' }}>
            📇 {busy ? '…' : 'Contacts'}
          </button>
        )}
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', maxHeight: 200, overflowY: 'auto' }}>
          {results.map(u => (
            <div key={u.id} onClick={() => add(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                       cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
              <div className="member-avatar" style={{ width: 32, height: 32, fontSize: 13 }}>
                {u.initials || u.name?.[0] || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>@{u.username}</div>
              </div>
              <span style={{ color: 'var(--purple-light)', fontWeight: 700 }}>＋</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
