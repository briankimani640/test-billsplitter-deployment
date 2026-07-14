import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import BottomNav from '../components/BottomNav';
import { useApp } from '../context/AppContext';
import { usersAPI, authAPI } from '../api/api';

function SettingRow({ icon, label, value, onClick, danger }) {
  return (
    <div onClick={onClick} style={{display:'flex',alignItems:'center',gap:14,padding:'14px 0',borderBottom:'1px solid var(--border)',cursor:onClick?'pointer':'default',transition:'opacity 0.2s'}}>
      <span style={{fontSize:20,width:28}}>{icon}</span>
      <div style={{flex:1}}>
        <div style={{fontSize:14,fontWeight:500,color:danger?'var(--red)':'var(--text-primary)'}}>{label}</div>
        {value && <div style={{fontSize:12,color:'var(--text-muted)',marginTop:1}}>{value}</div>}
      </div>
      {onClick && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
    </div>
  );
}

export default function Profile() {
  const { user, groups, stats, fmt, showToast, logout, loadAppData, darkMode, setDarkMode } = useApp();
  const navigate = useNavigate();

  const [editing,  setEditing]  = useState(false);
  const [name,     setName]     = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone,    setPhone]    = useState(user?.phone || '');
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Password change
  const [showPwdForm,  setShowPwdForm]  = useState(false);
  const [currentPwd,   setCurrentPwd]   = useState('');
  const [newPwd,       setNewPwd]       = useState('');
  const [pwdLoading,   setPwdLoading]   = useState(false);

  // Preferences
  const DEFAULT_PREFS = {
    currency: 'KSh', language: 'English', darkMode: true,
    notifyPaymentReminders: true, notifyExpenseAdded: true, notifyEmail: true,
  };
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);

  useEffect(() => {
    usersAPI.getPreferences()
      .then(res => setPrefs({ ...DEFAULT_PREFS, ...(res.data || {}) }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePref = async (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);                         // optimistic
    try {
      await usersAPI.updatePreferences({ [key]: value });
      showToast('✅ Preference saved');
    } catch {
      setPrefs(prefs);                      // revert on failure
      showToast('❌ Could not save preference');
    }
  };

  const cyclePref = (key, options) => {
    const i = options.indexOf(prefs[key]);
    savePref(key, options[(i + 1) % options.length]);
  };

  const resendVerification = async () => {
    try { await authAPI.resendVerification(user.email); showToast('✉️ Verification email sent'); }
    catch { showToast('❌ Could not send verification email'); }
  };

  const totalGroups   = groups.length;
  const totalExpenses = groups.reduce((s, g) => s + (g.expenseCount || 0), 0);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await usersAPI.updateProfile({ name, phone, username });
      await loadAppData();
      showToast('✅ Profile updated!');
      setEditing(false);
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    const ok = window.confirm(
      'Delete your account permanently? This removes your profile, group memberships and cannot be undone.'
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await usersAPI.deleteAccount();
      showToast('👋 Sorry to see you go. Your account has been deleted.', 4000);
      setTimeout(async () => {
        await logout();
        navigate('/login', { replace: true });
      }, 1200);
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Could not delete account'));
      setDeleting(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPwd.length < 6) { showToast('⚠️ New password must be at least 6 characters'); return; }
    setPwdLoading(true);
    try {
      await usersAPI.changePassword({ currentPassword: currentPwd, newPassword: newPwd });
      showToast('✅ Password changed!');
      setShowPwdForm(false);
      setCurrentPwd(''); setNewPwd('');
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Failed to change password'));
    } finally {
      setPwdLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to log out?')) return;
    await logout();
    navigate('/login', { replace: true });
  };

  const inputStyle = {
    width:'100%', background:'var(--bg-input)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-sm)', color:'var(--text-primary)',
    fontFamily:'Inter, sans-serif', fontSize:14, padding:'11px 14px',
    outline:'none', boxSizing:'border-box', marginBottom:10,
  };

  return (
    <div className="app-shell">
      <TopNav title="Profile" />
      <div className="page-content fade-in">
        {/* Avatar */}
        <div style={{padding:'32px 20px 20px',textAlign:'center'}}>
          <div style={{width:80,height:80,borderRadius:'50%',margin:'0 auto 16px',background:'linear-gradient(135deg, var(--purple-dark), var(--purple-primary))',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,fontWeight:700,boxShadow:'var(--shadow-purple)',border:'3px solid var(--purple-primary)'}}>
            {user?.initials || user?.name?.[0] || '?'}
          </div>

          {editing ? (
            <div style={{maxWidth:300,margin:'0 auto'}}>
              <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
              <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder="Username (how people find you)" />
              <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number" />
              <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                <button onClick={handleSaveProfile} disabled={saving}
                  style={{padding:'9px 20px',background:'var(--purple-primary)',color:'white',border:'none',borderRadius:'var(--radius-sm)',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)}
                  style={{padding:'9px 20px',background:'var(--bg-card-alt)',color:'var(--text-muted)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',fontSize:13,cursor:'pointer'}}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 style={{marginBottom:4}}>{user?.name}</h2>
              {user?.username && <p style={{color:'var(--purple-light)',fontSize:14,fontWeight:600}}>@{user.username}</p>}
              <p style={{color:'var(--text-muted)',fontSize:14}}>{user?.email}</p>
              {user?.phone && <p style={{color:'var(--text-muted)',fontSize:14}}>{user?.phone}</p>}
            </>
          )}
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,padding:'0 20px 20px'}}>
          {[
            {value: totalGroups,   label:'Groups'},
            {value: totalExpenses, label:'Expenses'},
            {value: fmt(stats?.totalSpent || 0), label:'Total Spent'},
          ].map((s, i) => (
            <div key={i} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'14px 10px',textAlign:'center'}}>
              <div style={{fontSize:i===2?12:20,fontWeight:800,color:'var(--purple-light)',marginBottom:4}}>{s.value}</div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Account settings */}
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',margin:'0 20px 16px',padding:'0 16px'}}>
          <p style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.8px',padding:'14px 0 6px'}}>Account</p>
          <SettingRow icon="✏️" label="Edit Profile"   onClick={() => { setEditing(p => !p); setShowPwdForm(false); }} />
          <SettingRow icon="📱" label="Phone Number" value={user?.phone || 'Not set'} onClick={() => { setEditing(true); setShowPwdForm(false); }} />
          <SettingRow icon="🔒" label="Change Password" onClick={() => { setShowPwdForm(p => !p); setEditing(false); }} />
        </div>

        {/* Password change form */}
        {showPwdForm && (
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',margin:'0 20px 16px',padding:'16px'}}>
            <p style={{fontSize:13,fontWeight:600,marginBottom:12}}>Change Password</p>
            <input style={inputStyle} type="password" placeholder="Current password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="New password (min 6 chars)" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            <button onClick={handleChangePassword} disabled={pwdLoading}
              style={{width:'100%',padding:'11px',background:'var(--purple-primary)',color:'white',border:'none',borderRadius:'var(--radius-sm)',fontSize:14,fontWeight:600,cursor:'pointer'}}>
              {pwdLoading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        )}

        {/* Notifications + Admin */}
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',margin:'0 20px 16px',padding:'0 16px'}}>
          <p style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.8px',padding:'14px 0 6px'}}>Activity</p>
          <SettingRow icon="🔔" label="Notifications" value="View all" onClick={() => navigate('/notifications')} />
          {!user?.email_verified && (
            <SettingRow icon="✉️" label="Verify email" value="Send link" onClick={resendVerification} />
          )}
          {user?.is_admin && (
            <SettingRow icon="🛡️" label="Admin dashboard" value="Monitor app" onClick={() => navigate('/admin')} />
          )}
        </div>

        {/* Preferences */}
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',margin:'0 20px 16px',padding:'0 16px'}}>
          <p style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.8px',padding:'14px 0 6px'}}>Preferences</p>
          <SettingRow icon="🌙" label="Dark Mode" value={darkMode ? 'On' : 'Off'} onClick={() => setDarkMode(!darkMode)} />
          <SettingRow icon="💱" label="Currency" value={prefs.currency} onClick={() => cyclePref('currency', ['KSh', 'USD', 'EUR', 'GBP'])} />
          <SettingRow icon="🌍" label="Language" value={prefs.language} onClick={() => cyclePref('language', ['English', 'Swahili'])} />
        </div>

        {/* Notification preferences */}
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',margin:'0 20px 16px',padding:'0 16px'}}>
          <p style={{fontSize:11,fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.8px',padding:'14px 0 6px'}}>Notification settings</p>
          <SettingRow icon="⏰" label="Payment reminders" value={prefs.notifyPaymentReminders ? 'On' : 'Off'} onClick={() => savePref('notifyPaymentReminders', !prefs.notifyPaymentReminders)} />
          <SettingRow icon="💸" label="New expense alerts" value={prefs.notifyExpenseAdded ? 'On' : 'Off'} onClick={() => savePref('notifyExpenseAdded', !prefs.notifyExpenseAdded)} />
          <SettingRow icon="📧" label="Email notifications" value={prefs.notifyEmail ? 'On' : 'Off'} onClick={() => savePref('notifyEmail', !prefs.notifyEmail)} />
        </div>

        {/* Danger zone */}
        <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',margin:'0 20px 24px',padding:'0 16px'}}>
          <SettingRow icon="🚪" label="Log Out" danger onClick={handleLogout} />
          <SettingRow icon="🗑️" label={deleting ? 'Deleting account…' : 'Delete Account'} value="Permanent" danger onClick={deleting ? undefined : handleDeleteAccount} />
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
