const db = require('../config/db');
const { createNotification } = require('../utils/notify');

// ── GET /api/groups ───────────────────────────────────────
exports.listGroups = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT g.*,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id)::int AS "memberCount",
              (SELECT COUNT(*) FROM expenses e WHERE e.group_id = g.id)::int        AS "expenseCount",
              (
                COALESCE((SELECT SUM(e.amount) FROM expenses e
                          WHERE e.group_id = g.id AND e.paid_by = $1), 0)
                - COALESCE((SELECT SUM(es.amount) FROM expense_splits es
                            JOIN expenses e2 ON e2.id = es.expense_id
                            WHERE e2.group_id = g.id AND es.user_id = $1), 0)
              ) AS balance
       FROM groups g
       WHERE g.id IN (SELECT group_id FROM group_members WHERE user_id = $1)
       ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) { next(err); }
};

// ── POST /api/groups ──────────────────────────────────────
exports.createGroup = async (req, res, next) => {
  const client = await require('../config/db').getClient();
  try {
    await client.query('BEGIN');
    const { name, icon = '💰', iconColor = 'group-icon-purple', memberIds = [] } = req.body;

    // Enforce max 10 members per group (creator + invitees)
    const uniqueInvitees = [...new Set(memberIds.filter(id => id !== req.user.id))];
    if (uniqueInvitees.length + 1 > 10) {
      await client.query('ROLLBACK');
      return res.status(422).json({ error: 'A group can have at most 10 members' });
    }

    const { rows } = await client.query(
      `INSERT INTO groups (name, icon, icon_color, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), icon, iconColor, req.user.id]
    );
    const group = rows[0];

    // Add creator as admin
    const allMembers = [req.user.id, ...uniqueInvitees];
    for (const userId of allMembers) {
      const role = userId === req.user.id ? 'admin' : 'member';
      await client.query(
        'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [group.id, userId, role]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ ...group, memberCount: allMembers.length, expenseCount: 0, balance: 0 });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
};

// ── GET /api/groups/:id ───────────────────────────────────
exports.getGroup = async (req, res, next) => {
  try {
    // Group details
    const { rows: [group] } = await db.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Members
    const { rows: members } = await db.query(
      `SELECT u.id, u.name, u.username, u.initials, u.avatar_url, gm.role,
              COALESCE(
                SUM(CASE WHEN e.paid_by = u.id THEN e.amount ELSE 0 END)
                - SUM(CASE WHEN es.user_id = u.id THEN es.amount ELSE 0 END),
                0
              ) AS balance
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN expenses e ON e.group_id = $1
       LEFT JOIN expense_splits es ON es.expense_id = e.id AND es.user_id = u.id
       WHERE gm.group_id = $1
       GROUP BY u.id, u.name, u.username, u.initials, u.avatar_url, gm.role`,
      [req.params.id]
    );

    // Expenses with per-member split breakdown
    const { rows: expenses } = await db.query(
      `SELECT e.*, u.name AS "paidByName", u.initials AS "paidByInitials",
              COALESCE((
                SELECT json_agg(json_build_object(
                  'userId', es.user_id, 'name', su.name, 'initials', su.initials, 'amount', es.amount
                ) ORDER BY su.name)
                FROM expense_splits es JOIN users su ON su.id = es.user_id
                WHERE es.expense_id = e.id
              ), '[]') AS splits
       FROM expenses e
       LEFT JOIN users u ON u.id = e.paid_by
       WHERE e.group_id = $1
       ORDER BY e.date DESC, e.created_at DESC`,
      [req.params.id]
    );

    // Current user's balance
    const me = members.find(m => m.id === req.user.id);
    const myBalance = me ? parseFloat(me.balance) : 0;

    return res.json({
      ...group,
      members,
      expenses,
      memberCount:  members.length,
      expenseCount: expenses.length,
      balance:      myBalance,
    });
  } catch (err) { next(err); }
};

// ── PUT /api/groups/:id ───────────────────────────────────
exports.updateGroup = async (req, res, next) => {
  try {
    const { name, icon, iconColor } = req.body;
    const { rows } = await db.query(
      `UPDATE groups
       SET name = COALESCE($1, name), icon = COALESCE($2, icon),
           icon_color = COALESCE($3, icon_color), updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name || null, icon || null, iconColor || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Group not found' });
    return res.json(rows[0]);
  } catch (err) { next(err); }
};

// ── DELETE /api/groups/:id ────────────────────────────────
// Net balance per member for a group, folding in CONFIRMED settlements.
// Returns { userId: net } where net > 0 means they are owed, < 0 means they owe.
async function groupNetBalances(groupId) {
  const { rows: exp } = await db.query('SELECT paid_by, amount FROM expenses WHERE group_id = $1', [groupId]);
  const { rows: spl } = await db.query(
    `SELECT es.user_id, es.amount FROM expense_splits es
     JOIN expenses e ON e.id = es.expense_id WHERE e.group_id = $1`, [groupId]);
  const { rows: paid } = await db.query(
    `SELECT from_user_id, to_user_id, amount FROM settlements
     WHERE group_id = $1 AND status = 'confirmed'`, [groupId]);

  const bal = {};
  for (const e of exp) if (e.paid_by) bal[e.paid_by] = (bal[e.paid_by] || 0) + parseFloat(e.amount);
  for (const s of spl) bal[s.user_id] = (bal[s.user_id] || 0) - parseFloat(s.amount);
  for (const p of paid) {
    bal[p.from_user_id] = (bal[p.from_user_id] || 0) + parseFloat(p.amount);
    bal[p.to_user_id]   = (bal[p.to_user_id]   || 0) - parseFloat(p.amount);
  }
  return bal;
}

exports.deleteGroup = async (req, res, next) => {
  try {
    const bal = await groupNetBalances(req.params.id);
    const unsettled = Object.values(bal).some(v => Math.abs(v) > 0.01);
    if (unsettled) {
      return res.status(422).json({ error: 'This group has unsettled bills. All balances must be settled before it can be deleted.' });
    }
    await db.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
    return res.json({ message: 'Group deleted' });
  } catch (err) { next(err); }
};

// ── POST /api/groups/:id/leave ────────────────────────────
// A member may leave only once they owe nothing in the group.
exports.leaveGroup = async (req, res, next) => {
  try {
    const groupId = req.params.id;
    const { rows: mem } = await db.query(
      'SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, req.user.id]);
    if (!mem.length) return res.status(404).json({ error: 'You are not a member of this group' });

    const bal = await groupNetBalances(groupId);
    const myBal = bal[req.user.id] || 0;
    if (myBal < -0.01) {
      return res.status(422).json({
        error: `Settle what you owe (KSh ${Math.abs(myBal).toLocaleString()}) before leaving this group.`,
      });
    }

    await db.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, req.user.id]);

    // If the leaver was the admin, hand admin to the next member (if any).
    if (mem[0].role === 'admin') {
      const { rows: others } = await db.query(
        `SELECT user_id FROM group_members WHERE group_id = $1 ORDER BY joined_at ASC LIMIT 1`, [groupId]);
      if (others.length) {
        await db.query(`UPDATE group_members SET role = 'admin' WHERE group_id = $1 AND user_id = $2`,
          [groupId, others[0].user_id]);
      }
    }
    return res.json({ message: 'You have left the group' });
  } catch (err) { next(err); }
};

// ── POST /api/groups/:id/members ─────────────────────────
exports.addMember = async (req, res, next) => {
  try {
    const { userId, role = 'member' } = req.body;

    // Enforce max 10 members
    const { rows: [c] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM group_members WHERE group_id = $1', [req.params.id]
    );
    if (c.n >= 10) {
      return res.status(422).json({ error: 'A group can have at most 10 members' });
    }

    await db.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.id, userId, role]
    );

    // Notify the added user
    const { rows: [g] } = await db.query('SELECT name FROM groups WHERE id = $1', [req.params.id]);
    await createNotification(userId, {
      type:  'system',
      title: `You were added to ${g?.name || 'a group'}`,
      body:  `${req.user.name} added you to the group "${g?.name || ''}".`,
      data:  { groupId: req.params.id },
    });

    return res.status(201).json({ message: 'Member added' });
  } catch (err) { next(err); }
};

// ── DELETE /api/groups/:id/members/:userId ────────────────
exports.removeMember = async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );
    return res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
};

// ── GET /api/groups/:id/balances ──────────────────────────
exports.getBalances = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.initials,
              ROUND(
                COALESCE(SUM(CASE WHEN e.paid_by = u.id THEN e.amount ELSE 0 END), 0)
                - COALESCE(SUM(es.amount), 0),
                2
              ) AS balance
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       LEFT JOIN expenses e ON e.group_id = $1
       LEFT JOIN expense_splits es ON es.expense_id = e.id AND es.user_id = u.id
       WHERE gm.group_id = $1
       GROUP BY u.id, u.name, u.initials`,
      [req.params.id]
    );
    return res.json(rows);
  } catch (err) { next(err); }
};
