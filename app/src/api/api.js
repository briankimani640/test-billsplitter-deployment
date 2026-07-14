import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Attach access token ───────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto-refresh on 401 ───────────────────────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
          const { accessToken } = res.data;
          localStorage.setItem('token', accessToken);
          original.headers.Authorization = `Bearer ${accessToken}`;
          return api(original);
        } catch {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ── AUTH ──────────────────────────────────────────────────
export const authAPI = {
  login:    (data)   => api.post('/auth/login', data),
  register: (data)   => api.post('/auth/register', data),
  logout:   (data)   => api.post('/auth/logout', data),
  me:       ()       => api.get('/auth/me'),
  forgotPassword:     (email)            => api.post('/auth/forgot-password', { email }),
  resetPassword:      (token, newPassword) => api.post('/auth/reset-password', { token, newPassword }),
  verifyEmail:        (token)            => api.post('/auth/verify-email', { token }),
  resendVerification: (email)            => api.post('/auth/resend-verification', { email }),
};

// ── USERS ─────────────────────────────────────────────────
export const usersAPI = {
  getProfile:      ()       => api.get('/users/me'),
  updateProfile:   (data)   => api.put('/users/me', data),
  changePassword:  (data)   => api.put('/users/me/password', data),
  searchUsers:     (query)  => api.get('/users/search', { params: { q: query } }),
  getPreferences:  ()       => api.get('/users/preferences'),
  updatePreferences: (data) => api.put('/users/preferences', data),
  lookupContacts:  (phones) => api.post('/users/lookup-contacts', { phones }),
  deleteAccount:   ()       => api.delete('/users/me'),
};

// ── NOTIFICATIONS ─────────────────────────────────────────
export const notificationsAPI = {
  list:        ()   => api.get('/notifications'),
  unreadCount: ()   => api.get('/notifications/unread-count'),
  markRead:    (id) => api.put(`/notifications/${id}/read`),
  markAllRead: ()   => api.put('/notifications/read-all'),
  remove:      (id) => api.delete(`/notifications/${id}`),
};

// ── ADMIN ─────────────────────────────────────────────────
export const adminAPI = {
  overview:  ()                 => api.get('/admin/overview'),
  metrics:   ()                 => api.get('/admin/metrics'),
  users:     (q)                => api.get('/admin/users', { params: { q } }),
  groups:    ()                 => api.get('/admin/groups'),
  setAdmin:  (id, isAdmin)      => api.put(`/admin/users/${id}/admin`, { isAdmin }),
};

// ── GROUPS ────────────────────────────────────────────────
export const groupsAPI = {
  list:         ()           => api.get('/groups'),
  create:       (data)       => api.post('/groups', data),
  createWithMembers: (name, icon, iconColor, memberIds) =>
    api.post('/groups', { name, icon, iconColor, memberIds }),
  get:          (id)         => api.get(`/groups/${id}`),
  update:       (id, data)   => api.put(`/groups/${id}`, data),
  delete:       (id)         => api.delete(`/groups/${id}`),
  leave:        (id)         => api.post(`/groups/${id}/leave`),
  addMember:    (id, userId) => api.post(`/groups/${id}/members`, { userId }),
  removeMember: (id, userId) => api.delete(`/groups/${id}/members/${userId}`),
  getBalances:  (id)         => api.get(`/groups/${id}/balances`),
  getExpenses:  (id)         => api.get(`/groups/${id}/expenses`),
};

// ── EXPENSES ──────────────────────────────────────────────
export const expensesAPI = {
  create: (data) => {
    const form = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        form.append(k, typeof v === 'object' && !(v instanceof File) ? JSON.stringify(v) : v);
      }
    });
    return api.post('/expenses', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  get:    (id)       => api.get(`/expenses/${id}`),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id)       => api.delete(`/expenses/${id}`),
};

// ── IOUs ──────────────────────────────────────────────────
export const iousAPI = {
  list:     () => api.get('/ious'),
  iOwe:     () => api.get('/ious/i-owe'),
  owedToMe: () => api.get('/ious/owed-to-me'),
};

// ── SETTLEMENTS ───────────────────────────────────────────
export const settlementsAPI = {
  list:         ()       => api.get('/settlements'),
  getSuggested: ()       => api.get('/settlements/suggested'),
  getPending:   ()       => api.get('/settlements/pending'),
  create:       (data)   => api.post('/settlements', data),
  confirm:      (id)     => api.put(`/settlements/${id}/confirm`),
  markPaid:     (id)     => api.put(`/settlements/${id}/paid`),
};
export const disputesAPI = {
  list:    ()       => api.get('/disputes'),
  create:  (data)   => api.post('/disputes', data),
  resolve: (id)     => api.put(`/disputes/${id}/resolve`),
};

// ── STATS ─────────────────────────────────────────────────
export const statsAPI = {
  summary:    (period) => api.get('/stats/summary', { params: { period } }),
  byCategory: (period) => api.get('/stats/by-category', { params: { period } }),
  byMonth:    ()       => api.get('/stats/by-month'),
  byGroup:    ()       => api.get('/stats/by-group'),
};

// ── OCR ───────────────────────────────────────────────────
export const ocrAPI = {
  processReceipt: (file) => {
    const form = new FormData();
    form.append('receipt', file);
    return api.post('/ocr/receipt', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export default api;
