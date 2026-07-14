const db = require('../config/db');

// ── GET /api/notifications ────────────────────────────────
exports.list = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50'), 100);
    const { rows } = await db.query(
      `SELECT id, type, title, body, data, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    return res.json(rows);
  } catch (err) { next(err); }
};

// ── GET /api/notifications/unread-count ───────────────────
exports.unreadCount = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [req.user.id]
    );
    return res.json({ count: rows[0].count });
  } catch (err) { next(err); }
};

// ── PUT /api/notifications/:id/read ───────────────────────
exports.markRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL',
      [req.params.id, req.user.id]
    );
    return res.json({ message: 'Marked read' });
  } catch (err) { next(err); }
};

// ── PUT /api/notifications/read-all ───────────────────────
exports.markAllRead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
      [req.user.id]
    );
    return res.json({ message: 'All marked read' });
  } catch (err) { next(err); }
};

// ── DELETE /api/notifications/:id ─────────────────────────
exports.remove = async (req, res, next) => {
  try {
    await db.query('DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]);
    return res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
