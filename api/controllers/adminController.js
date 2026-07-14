const db = require('../config/db');

// ── GET /api/admin/overview ───────────────────────────────
// High-level counts for the admin dashboard.
exports.overview = async (req, res, next) => {
  try {
    const q = (sql) => db.query(sql).then(r => parseInt(r.rows[0].n));
    const [users, verified, admins, groups, expenses, settlements, pending] = await Promise.all([
      q('SELECT COUNT(*)::int AS n FROM users'),
      q('SELECT COUNT(*)::int AS n FROM users WHERE email_verified = TRUE'),
      q('SELECT COUNT(*)::int AS n FROM users WHERE is_admin = TRUE'),
      q('SELECT COUNT(*)::int AS n FROM groups'),
      q('SELECT COUNT(*)::int AS n FROM expenses'),
      q('SELECT COUNT(*)::int AS n FROM settlements'),
      q("SELECT COUNT(*)::int AS n FROM settlements WHERE status = 'pending'"),
    ]);

    const { rows: [vol] } = await db.query(
      'SELECT COALESCE(SUM(amount),0)::float AS total FROM expenses'
    );
    const { rows: signups } = await db.query(
      `SELECT TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS count
       FROM users
       WHERE created_at >= NOW() - INTERVAL '14 days'
       GROUP BY day ORDER BY day`
    );

    return res.json({
      users, verifiedUsers: verified, admins, groups, expenses,
      settlements, pendingSettlements: pending,
      totalExpenseVolume: vol.total,
      signupsLast14Days: signups,
    });
  } catch (err) { next(err); }
};

// ── GET /api/admin/users ──────────────────────────────────
exports.listUsers = async (req, res, next) => {
  try {
    const q = `%${(req.query.q || '').toLowerCase()}%`;
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.is_admin, u.email_verified,
              u.created_at, u.last_login_at,
              COUNT(DISTINCT gm.group_id)::int AS "groupCount"
       FROM users u
       LEFT JOIN group_members gm ON gm.user_id = u.id
       WHERE LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT 200`,
      [q]
    );
    return res.json(rows);
  } catch (err) { next(err); }
};

// ── PUT /api/admin/users/:id/admin ────────────────────────
// Grant/revoke super-admin. Body: { isAdmin: true|false }
exports.setAdmin = async (req, res, next) => {
  try {
    const isAdmin = req.body.isAdmin === true;
    if (req.params.id === req.user.id && !isAdmin) {
      return res.status(400).json({ error: 'You cannot remove your own admin access' });
    }
    const { rows } = await db.query(
      'UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, name, email, is_admin',
      [isAdmin, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (err) { next(err); }
};

// ── GET /api/admin/groups ─────────────────────────────────
exports.listGroups = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT g.id, g.name, g.icon, g.created_at,
              u.name AS "createdBy",
              COUNT(DISTINCT gm.user_id)::int AS "memberCount",
              COUNT(DISTINCT e.id)::int        AS "expenseCount"
       FROM groups g
       LEFT JOIN users u ON u.id = g.created_by
       LEFT JOIN group_members gm ON gm.group_id = g.id
       LEFT JOIN expenses e ON e.group_id = g.id
       GROUP BY g.id, u.name
       ORDER BY g.created_at DESC
       LIMIT 200`
    );
    return res.json(rows);
  } catch (err) { next(err); }
};

// ── GET /api/admin/metrics ────────────────────────────────
// Request-level monitoring from the request_logs table.
exports.metrics = async (req, res, next) => {
  try {
    const { rows: [recent] } = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status >= 500)::int AS errors,
              COUNT(*) FILTER (WHERE status >= 400 AND status < 500)::int AS client_errors,
              COALESCE(ROUND(AVG(duration_ms))::int, 0) AS avg_ms,
              COALESCE(MAX(duration_ms), 0) AS max_ms
       FROM request_logs
       WHERE created_at >= NOW() - INTERVAL '24 hours'`
    );
    const { rows: slowest } = await db.query(
      `SELECT method, path, status, duration_ms, created_at
       FROM request_logs
       WHERE created_at >= NOW() - INTERVAL '24 hours'
       ORDER BY duration_ms DESC LIMIT 10`
    );
    const { rows: byStatus } = await db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM request_logs
       WHERE created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY status ORDER BY status`
    );

    return res.json({ window: '24h', summary: recent, byStatus, slowest });
  } catch (err) { next(err); }
};
