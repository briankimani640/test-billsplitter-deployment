const db = require('../config/db');

// ── GET /api/groups/:groupId/expenses ─────────────────────
exports.listExpenses = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*, u.name AS "paidByName", u.initials AS "paidByInitials",
              COALESCE(
                (SELECT es.amount FROM expense_splits es
                 WHERE es.expense_id = e.id AND es.user_id = $2),
                0
              ) AS "yourSplit"
       FROM expenses e
       LEFT JOIN users u ON u.id = e.paid_by
       WHERE e.group_id = $1
       ORDER BY e.date DESC, e.created_at DESC`,
      [req.params.groupId, req.user.id]
    );
    return res.json(rows);
  } catch (err) { next(err); }
};

// ── POST /api/expenses ────────────────────────────────────
exports.createExpense = async (req, res, next) => {
  const client = await require('../config/db').getClient();
  try {
    await client.query('BEGIN');

    const {
      groupId, description, amount, paidBy, category = 'Other',
      emoji = '📦', splitType = 'equal', date, notes,
    } = req.body;

    // With multipart/form-data uploads, array/object fields arrive as JSON
    // strings — parse `splits` back into an array before using it.
    let splits = req.body.splits;
    if (typeof splits === 'string') {
      try { splits = JSON.parse(splits); } catch { splits = []; }
    }
    if (!Array.isArray(splits)) splits = [];

    const receiptUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Insert expense
    const { rows: [expense] } = await client.query(
      `INSERT INTO expenses
         (group_id, description, amount, paid_by, category, emoji, split_type, date, receipt_url, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [groupId, description.trim(), amount, paidBy, category, emoji, splitType,
       date || new Date().toISOString().slice(0, 10), receiptUrl, notes || null]
    );

    // Build splits
    let splitRows = [];
    if (splitType === 'equal') {
      // Get all group members
      const { rows: members } = await client.query(
        'SELECT user_id FROM group_members WHERE group_id = $1',
        [groupId]
      );
      const share = parseFloat((amount / members.length).toFixed(2));
      splitRows = members.map(m => ({ userId: m.user_id, amount: share }));
    } else if (splitType === 'percent') {
      // caller provides [{userId, amount: <percent>}] — must total 100%
      const totalPct = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.1) {
        await client.query('ROLLBACK');
        return res.status(422).json({ error: `Percentages must add up to 100% (got ${totalPct}%)` });
      }
      splitRows = splits.map(s => ({
        userId: s.userId,
        amount: parseFloat(((s.amount / 100) * parseFloat(amount)).toFixed(2)),
      }));
    } else {
      // exact — caller provides [{userId, amount}] — must total the full amount
      splitRows = splits.map(s => ({ userId: s.userId, amount: parseFloat(s.amount) || 0 }));
      const totalSplit = splitRows.reduce((s, x) => s + x.amount, 0);
      if (Math.abs(totalSplit - parseFloat(amount)) > 0.01) {
        await client.query('ROLLBACK');
        return res.status(422).json({
          error: `Split amounts must add up to the total (${totalSplit.toFixed(2)} of ${parseFloat(amount).toFixed(2)})`,
        });
      }
    }

    for (const s of splitRows) {
      await client.query(
        `INSERT INTO expense_splits (expense_id, user_id, amount)
         VALUES ($1, $2, $3) ON CONFLICT (expense_id, user_id) DO UPDATE SET amount = $3`,
        [expense.id, s.userId, s.amount]
      );
    }

    await client.query('COMMIT');

    // Return enriched expense
    const { rows: [full] } = await db.query(
      `SELECT e.*, u.name AS "paidByName", u.initials AS "paidByInitials"
       FROM expenses e LEFT JOIN users u ON u.id = e.paid_by WHERE e.id = $1`,
      [expense.id]
    );
    return res.status(201).json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
};

// ── GET /api/expenses/:id ─────────────────────────────────
exports.getExpense = async (req, res, next) => {
  try {
    const { rows: [expense] } = await db.query(
      `SELECT e.*, u.name AS "paidByName", u.initials AS "paidByInitials"
       FROM expenses e LEFT JOIN users u ON u.id = e.paid_by WHERE e.id = $1`,
      [req.params.id]
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const { rows: splits } = await db.query(
      `SELECT es.*, u.name, u.initials
       FROM expense_splits es JOIN users u ON u.id = es.user_id
       WHERE es.expense_id = $1`,
      [req.params.id]
    );

    return res.json({ ...expense, splits });
  } catch (err) { next(err); }
};

// ── PUT /api/expenses/:id ─────────────────────────────────
exports.updateExpense = async (req, res, next) => {
  try {
    const { description, amount, category, emoji, date, notes } = req.body;
    const { rows } = await db.query(
      `UPDATE expenses
       SET description = COALESCE($1, description),
           amount      = COALESCE($2, amount),
           category    = COALESCE($3, category),
           emoji       = COALESCE($4, emoji),
           date        = COALESCE($5, date),
           notes       = COALESCE($6, notes),
           updated_at  = NOW()
       WHERE id = $7 RETURNING *`,
      [description || null, amount || null, category || null,
       emoji || null, date || null, notes || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Expense not found' });
    return res.json(rows[0]);
  } catch (err) { next(err); }
};

// ── DELETE /api/expenses/:id ──────────────────────────────
exports.deleteExpense = async (req, res, next) => {
  try {
    await db.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Expense deleted' });
  } catch (err) { next(err); }
};
