import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, groupsAPI, iousAPI, settlementsAPI, statsAPI, disputesAPI } from '../api/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user,            setUser]            = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading,         setLoading]         = useState(true);   // initial auth check
  const [dataLoading,     setDataLoading]     = useState(false);  // loading app data

  const [groups,      setGroups]      = useState([]);
  const [ious,        setIOUs]        = useState({ iOwe: [], owedToMe: [] });
  const [settlements, setSettlements] = useState([]);
  const [pending,     setPending]     = useState({ toConfirm: [], awaiting: [] });
  const [disputes,    setDisputes]    = useState([]);
  const [stats,       setStats]       = useState(null);

  const [toast, setToast] = useState(null);

  // ── Theme (dark / light) ───────────────────────────────
  const getInitialDark = () => {
    const stored = localStorage.getItem('theme');
    if (stored === 'light') return false;
    if (stored === 'dark')  return true;
    return true; // default dark
  };
  const [darkMode, setDarkModeState] = useState(getInitialDark);

  // Apply the theme attribute to <html> whenever it changes
  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [darkMode]);

  // Toggle + persist to the server preference (best-effort)
  const setDarkMode = useCallback((value) => {
    setDarkModeState(value);
    import('../api/api').then(({ usersAPI }) => {
      usersAPI.updatePreferences({ darkMode: value }).catch(() => {});
    });
  }, []);
  const toggleDarkMode = useCallback(() => setDarkModeState(v => !v), []);

  // ── Toast ──────────────────────────────────────────────
  const showToast = useCallback((msg, duration = 2800) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  }, []);

  // ── Format KSh ─────────────────────────────────────────
  const fmt = (n) => `KSh ${Math.abs(parseFloat(n) || 0).toLocaleString('en-KE')}`;

  // ── Load all app data ───────────────────────────────────
  const loadAppData = useCallback(async () => {
    setDataLoading(true);
    try {
      const [groupsRes, iousRes, settlementsRes, statsRes, pendingRes, disputesRes] = await Promise.allSettled([
        groupsAPI.list(),
        iousAPI.list(),
        settlementsAPI.getSuggested(),
        statsAPI.summary('month'),
        settlementsAPI.getPending(),
        disputesAPI.list(),
      ]);

      if (groupsRes.status      === 'fulfilled') setGroups(groupsRes.value.data);
      if (iousRes.status        === 'fulfilled') setIOUs(iousRes.value.data);
      if (settlementsRes.status === 'fulfilled') setSettlements(settlementsRes.value.data);
      if (statsRes.status       === 'fulfilled') setStats(statsRes.value.data);
      if (pendingRes.status     === 'fulfilled') setPending(pendingRes.value.data);
      if (disputesRes.status    === 'fulfilled') setDisputes(disputesRes.value.data);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  // ── Check auth on first load ────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    authAPI.me()
      .then(res => {
        setUser(res.data);
        setIsAuthenticated(true);
        if (res.data?.preferences && typeof res.data.preferences.darkMode === 'boolean') {
          setDarkModeState(res.data.preferences.darkMode);
        }
        return loadAppData();
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      })
      .finally(() => setLoading(false));
  }, [loadAppData]);

  // ── LOGIN ───────────────────────────────────────────────
  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { user: u, accessToken, refreshToken } = res.data;
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(u);
    setIsAuthenticated(true);
    await loadAppData();
    return u;
  };

  // ── REGISTER ────────────────────────────────────────────
  const register = async (name, email, password, phone, username) => {
    const res = await authAPI.register({ name, email, password, phone, username });
    const { user: u, accessToken, refreshToken } = res.data;
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(u);
    setIsAuthenticated(true);
    return u;
  };

  // ── LOGOUT ──────────────────────────────────────────────
  const logout = async () => {
    try {
      await authAPI.logout({ refreshToken: localStorage.getItem('refreshToken') });
    } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setIsAuthenticated(false);
    setGroups([]);
    setIOUs({ iOwe: [], owedToMe: [] });
    setPending({ toConfirm: [], awaiting: [] });
    setDisputes([]);
    setSettlements([]);
    setStats(null);
  };

  // ── REFRESH HELPERS ─────────────────────────────────────
  const refreshGroups      = async () => { const r = await groupsAPI.list();          setGroups(r.data); };
  const refreshIOUs        = async () => { const r = await iousAPI.list();             setIOUs(r.data); };
  const refreshSettlements = async () => { const r = await settlementsAPI.getSuggested(); setSettlements(r.data); };
  const refreshPending     = async () => { const r = await settlementsAPI.getPending();   setPending(r.data); };
  const refreshDisputes    = async () => { const r = await disputesAPI.list();            setDisputes(r.data); };
  // Pull everything that changes when money moves — used by the Settle tab / dashboard.
  const refreshMoney = async () => {
    await Promise.allSettled([refreshSettlements(), refreshPending(), refreshIOUs(), refreshDisputes()]);
  };

  // ── DERIVED TOTALS ──────────────────────────────────────
  const totalOwe   = (ious.iOwe    || []).reduce((s, p) => s + parseFloat(p.totalAmount || 0), 0);
  const totalOwedMe = (ious.owedToMe || []).reduce((s, p) => s + parseFloat(p.totalAmount || 0), 0);

  return (
    <AppContext.Provider value={{
      user, isAuthenticated, loading, dataLoading,
      groups, ious, settlements, stats,
      pending, disputes,
      totalOwe, totalOwedMe, fmt,
      login, register, logout,
      loadAppData, refreshGroups, refreshIOUs, refreshSettlements,
      refreshPending, refreshDisputes, refreshMoney,
      showToast, toast,
      setGroups,
      darkMode, setDarkMode, toggleDarkMode,
    }}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
