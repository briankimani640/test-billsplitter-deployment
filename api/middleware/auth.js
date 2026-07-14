const jwt = require('jsonwebtoken');
const db  = require('../config/db');

// ── Protect routes — require valid access token ───────────
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await db.query(
      `SELECT id, name, email, username, phone, avatar_url, initials,
              is_admin, email_verified, preferences
       FROM users WHERE id = $1`,
      [decoded.userId]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ── App-wide super admin only ─────────────────────────────
const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ── Check user is a member of a group ────────────────────
const groupMember = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }
    req.memberRole = rows[0].role;
    next();
  } catch (err) {
    next(err);
  }
};

// ── Check user is a group admin ───────────────────────────
const groupAdmin = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      "SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin'",
      [req.params.id, req.user.id]
    );
    if (!rows.length) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { protect, adminOnly, groupMember, groupAdmin };
