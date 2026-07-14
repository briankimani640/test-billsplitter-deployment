const bcrypt = require('bcryptjs');
const db     = require('../config/db');
const mail   = require('../utils/email');

// ── GET /api/users/me ─────────────────────────────────────
exports.getProfile = (req, res) => res.json(req.user);

// ── PUT /api/users/me ─────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, username } = req.body;

    // If a phone is supplied, normalise + enforce 10 digits
    let cleanPhone;
    if (phone !== undefined && phone !== null && phone !== '') {
      cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return res.status(422).json({ error: 'Phone number must be exactly 10 digits' });
      }
    }

    // If a username is supplied, validate format + uniqueness
    let cleanUsername;
    if (username !== undefined && username !== null && username !== '') {
      cleanUsername = String(username).trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        return res.status(422).json({ error: 'Username must be 3-20 letters, numbers or underscores' });
      }
      const taken = await db.query(
        'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id != $2 LIMIT 1',
        [cleanUsername, req.user.id]
      );
      if (taken.rows.length) {
        return res.status(409).json({ error: 'That username is already taken' });
      }
    }

    const initials = name
      ? name.split(' ').map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('')
      : undefined;

    const { rows } = await db.query(
      `UPDATE users
       SET name       = COALESCE($1, name),
           phone      = COALESCE($2, phone),
           initials   = COALESCE($3, initials),
           username   = COALESCE($4, username),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, email, username, phone, initials, avatar_url, is_admin, email_verified, preferences`,
      [name || null, cleanPhone || null, initials || null, cleanUsername || null, req.user.id]
    );

    return res.json(rows[0]);
  } catch (err) { next(err); }
};

// ── PUT /api/users/me/password ────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(422).json({ error: 'New password must be at least 6 characters' });
    }

    const { rows } = await db.query(
      'SELECT name, email, password_hash FROM users WHERE id = $1', [req.user.id]
    );
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user.id]);

    // Email notification on password change
    mail.sendPasswordChangedEmail(rows[0].email, rows[0].name);

    return res.json({ message: 'Password updated' });
  } catch (err) { next(err); }
};

// ── GET /api/users/preferences ────────────────────────────
exports.getPreferences = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT preferences FROM users WHERE id = $1', [req.user.id]);
    return res.json(rows[0]?.preferences || {});
  } catch (err) { next(err); }
};

// ── PUT /api/users/preferences ────────────────────────────
// Merges the incoming object into the stored JSONB preferences.
exports.updatePreferences = async (req, res, next) => {
  try {
    const incoming = req.body && typeof req.body === 'object' ? req.body : {};
    // Whitelist allowed keys to avoid storing junk
    const allowed = ['currency', 'language', 'darkMode',
                     'notifyPaymentReminders', 'notifyExpenseAdded', 'notifyEmail'];
    const patch = {};
    for (const k of allowed) if (k in incoming) patch[k] = incoming[k];

    const { rows } = await db.query(
      `UPDATE users
       SET preferences = COALESCE(preferences, '{}'::jsonb) || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2
       RETURNING preferences`,
      [JSON.stringify(patch), req.user.id]
    );
    return res.json(rows[0].preferences);
  } catch (err) { next(err); }
};

// ── GET /api/users/search?q=... ───────────────────────────
// Finds people by @username only. Name/email are never used or exposed here.
exports.searchUsers = async (req, res, next) => {
  try {
    const raw = (req.query.q || '').trim().replace(/^@/, '').toLowerCase();
    if (!raw) return res.json([]);
    const q = `%${raw}%`;
    const { rows } = await db.query(
      `SELECT id, name, username, initials, avatar_url
       FROM users
       WHERE LOWER(username) LIKE $1
         AND id != $2
       ORDER BY (LOWER(username) = $3) DESC, username ASC
       LIMIT 10`,
      [q, req.user.id, raw]
    );
    return res.json(rows);
  } catch (err) { next(err); }
};

// ── DELETE /api/users/me ──────────────────────────────────
// Permanently deletes the account. All related rows (group memberships,
// splits, settlements, tokens, notifications) cascade automatically.
exports.deleteAccount = async (req, res, next) => {
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    return res.json({ message: 'Account deleted' });
  } catch (err) { next(err); }
};

// ── POST /api/users/lookup-contacts ───────────────────────
// Body: { phones: ["0712345678", ...] } → returns matching app users.
// Used by the "add from contacts" flow to find which contacts use the app.
exports.lookupContacts = async (req, res, next) => {
  try {
    const phones = Array.isArray(req.body.phones) ? req.body.phones : [];
    const cleaned = phones
      .map(p => String(p).replace(/\D/g, ''))
      .map(p => (p.length > 10 ? p.slice(-10) : p))  // last 10 digits
      .filter(p => p.length === 10);

    if (!cleaned.length) return res.json([]);

    const { rows } = await db.query(
      `SELECT id, name, username, phone, initials, avatar_url
       FROM users
       WHERE RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = ANY($1)
         AND id != $2`,
      [cleaned, req.user.id]
    );
    return res.json(rows);
  } catch (err) { next(err); }
};
