const db = require('../config/db');

// ── GET /api/stats/summary?period=month|quarter|year ─────
exports.summary = async (req, res, next) => {
  try {
    const period = req.query.period || 'month';
    const interval = period === 'year' ? '1 year' : period === 'quarter' ? '3 months' : (period === 'day' || period === 'daily') ? '1 day' : '1 month';

    // Total spent (expenses in groups where user is a member)
    const { rows: [spent] } = await db.query(
      `SELECT COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e
       JOIN group_members gm ON gm.group_id = e.group_id
       WHERE gm.user_id = $1 AND e.date >= NOW() - INTERVAL '${interval}'`,
      [req.user.id]
    );

    // You owe (sum of splits where you didn't pay)
    const { rows: [owe] } = await db.query(
      `SELECT COALESCE(SUM(es.amount), 0) AS total
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       WHERE es.user_id = $1 AND e.paid_by != $1
         AND e.date >= NOW() - INTERVAL '${interval}'`,
      [req.user.id, req.user.id]
    );

    // Owed to you (splits of expenses you paid, for other people)
    const { rows: [owed] } = await db.query(
      `SELECT COALESCE(SUM(es.amount), 0) AS total
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.paid_by = $1 AND es.user_id != $1
         AND e.date >= NOW() - INTERVAL '${interval}'`,
      [req.user.id, req.user.id]
    );

    return res.json({
      totalSpent:  parseFloat(spent.total),
      youOwe:      parseFloat(owe.total),
      owedToYou:   parseFloat(owed.total),
      netBalance:  parseFloat(owed.total) - parseFloat(owe.total),
    });
  } catch (err) { next(err); }
};

// ── GET /api/stats/by-category?period=... ────────────────
exports.byCategory = async (req, res, next) => {
  try {
    const period = req.query.period || 'month';
    const interval = period === 'year' ? '1 year' : period === 'quarter' ? '3 months' : (period === 'day' || period === 'daily') ? '1 day' : '1 month';

    const { rows } = await db.query(
      `SELECT e.category, e.emoji,
              COALESCE(SUM(es.amount), 0) AS amount,
              COUNT(DISTINCT e.id)::int   AS count
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       JOIN group_members gm ON gm.group_id = e.group_id
       WHERE gm.user_id = $1
         AND e.date >= NOW() - INTERVAL '${interval}'
       GROUP BY e.category, e.emoji
       ORDER BY amount DESC`,
      [req.user.id]
    );

    const total = rows.reduce((s, r) => s + parseFloat(r.amount), 0);
    const withPercent = rows.map(r => ({
      ...r,
      amount:  parseFloat(r.amount),
      percent: total > 0 ? Math.round((parseFloat(r.amount) / total) * 100) : 0,
    }));

    return res.json(withPercent);
  } catch (err) { next(err); }
};

// ── GET /api/stats/by-month ───────────────────────────────
exports.byMonth = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT TO_CHAR(e.date, 'Mon') AS month,
              TO_CHAR(e.date, 'YYYY-MM') AS "yearMonth",
              COALESCE(SUM(es.amount), 0) AS amount
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       JOIN group_members gm ON gm.group_id = e.group_id
       WHERE gm.user_id = $1
         AND e.date >= NOW() - INTERVAL '6 months'
       GROUP BY TO_CHAR(e.date, 'Mon'), TO_CHAR(e.date, 'YYYY-MM')
       ORDER BY "yearMonth" ASC`,
      [req.user.id]
    );

    return res.json(rows.map(r => ({ month: r.month, amount: parseFloat(r.amount) })));
  } catch (err) { next(err); }
};

// ── GET /api/stats/by-group ───────────────────────────────
exports.byGroup = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT g.id, g.name, g.icon, g.icon_color,
              COALESCE(SUM(e.amount), 0) AS total,
              COUNT(DISTINCT e.id)::int  AS "expenseCount"
       FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       LEFT JOIN expenses e ON e.group_id = g.id
       WHERE gm.user_id = $1
       GROUP BY g.id, g.name, g.icon, g.icon_color
       ORDER BY total DESC`,
      [req.user.id]
    );
    return res.json(rows.map(r => ({ ...r, total: parseFloat(r.total) })));
  } catch (err) { next(err); }
};
