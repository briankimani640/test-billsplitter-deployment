const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const tokens  = require('../utils/tokens');
const mail    = require('../utils/email');

// ── Token helpers ─────────────────────────────────────────
function signAccess(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
}
function signRefresh(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0]?.toUpperCase() || '')
    .slice(0, 2)
    .join('');
}

// Turn any string into a valid handle, then guarantee it's unique in the DB.
async function makeUniqueUsername(base) {
  let handle = String(base || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24) || 'user';
  let candidate = handle;
  let n = 0;
  // Loop until we find a free handle (case-insensitive)
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await db.query(
      'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [candidate]
    );
    if (!rows.length) return candidate;
    n += 1;
    candidate = `${handle}${n}`;
  }
}

// ── POST /api/auth/register ───────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, phone, username } = req.body;

    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Username: use the one supplied, else derive from email. Ensure it's unique.
    if (username) {
      const taken = await db.query(
        'SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [username]
      );
      if (taken.rows.length) {
        return res.status(409).json({ error: 'That username is already taken' });
      }
    }
    const finalUsername = await makeUniqueUsername(username || email.split('@')[0]);

    const hash     = await bcrypt.hash(password, 12);
    const initials = getInitials(name);

    const { rows } = await db.query(
      `INSERT INTO users (name, email, phone, password_hash, initials, username)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, username, phone, initials, avatar_url, email_verified, is_admin, created_at`,
      [name.trim(), email.toLowerCase().trim(), phone || null, hash, initials, finalUsername]
    );

    const user         = rows[0];
    const accessToken  = signAccess(user.id);
    const refreshToken = signRefresh(user.id);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );

    // Send email verification (valid 24h)
    const verifyToken = await tokens.issueToken(user.id, 'verify', 24 * 60);
    mail.sendVerificationEmail(user.email, user.name, verifyToken);

    return res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) { next(err); }
};

// ── POST /api/auth/login ──────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken  = signAccess(user.id);
    const refreshToken = signRefresh(user.id);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refreshToken, expiresAt]
    );
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const { password_hash, ...safeUser } = user;
    return res.json({ user: safeUser, accessToken, refreshToken });
  } catch (err) { next(err); }
};

// ── POST /api/auth/refresh ────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const { rows } = await db.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
      [refreshToken, decoded.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const accessToken = signAccess(decoded.userId);
    return res.json({ accessToken });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    next(err);
  }
};

// ── POST /api/auth/logout ─────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    return res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
};

// ── GET /api/auth/me ──────────────────────────────────────
exports.me = (req, res) => res.json(req.user);

// ── POST /api/auth/forgot-password ────────────────────────
// Always 200 so we never reveal which emails are registered.
exports.forgotPassword = async (req, res, next) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const { rows } = await db.query('SELECT id, name, email FROM users WHERE email = $1', [email]);

    if (rows.length) {
      const token = await tokens.issueToken(rows[0].id, 'reset', 60); // 60 minutes
      mail.sendPasswordResetEmail(rows[0].email, rows[0].name, token);
    }
    return res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { next(err); }
};

// ── POST /api/auth/reset-password ─────────────────────────
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(422).json({ error: 'Password must be at least 6 characters' });
    }

    const row = await tokens.consumeToken(token, 'reset');
    if (!row) return res.status(400).json({ error: 'Invalid or expired reset link' });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, row.user_id]);

    // Force re-login everywhere
    await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [row.user_id]);

    const { rows: u } = await db.query('SELECT name, email FROM users WHERE id = $1', [row.user_id]);
    if (u.length) mail.sendPasswordChangedEmail(u[0].email, u[0].name);

    return res.json({ message: 'Password reset successful. Please log in.' });
  } catch (err) { next(err); }
};

// ── POST /api/auth/verify-email ───────────────────────────
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const row = await tokens.consumeToken(token, 'verify');
    if (!row) return res.status(400).json({ error: 'Invalid or expired verification link' });

    await db.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [row.user_id]);
    return res.json({ message: 'Email verified' });
  } catch (err) { next(err); }
};

// ── POST /api/auth/resend-verification ────────────────────
exports.resendVerification = async (req, res, next) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const { rows } = await db.query(
      'SELECT id, name, email, email_verified FROM users WHERE email = $1', [email]
    );
    if (rows.length && !rows[0].email_verified) {
      const token = await tokens.issueToken(rows[0].id, 'verify', 24 * 60);
      mail.sendVerificationEmail(rows[0].email, rows[0].name, token);
    }
    return res.json({ message: 'If that account needs verification, a new link has been sent.' });
  } catch (err) { next(err); }
};
