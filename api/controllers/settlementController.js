const db = require('../config/db');
const { calculateMinSettlements, calcGroupBalances } = require('../utils/settlementEngine');
const { createNotification } = require('../utils/notify');

// A settlement counts against the debt only once the recipient confirms it.
const REDUCING = `('confirmed')`;

// ── GET /api/settlements ──────────────────────────────────
exports.listSettlements = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*,
              uf.name AS "fromName", uf.initials AS "fromInitials",
              ut.name AS "toName",   ut.initials AS "toInitials",
              g.name  AS "groupName"
       FROM settlements s
       JOIN users uf ON uf.id = s.from_user_id
       JOIN users ut ON ut.id = s.to_user_id
       LEFT JOIN groups g ON g.id = s.group_id
       WHERE s.from_user_id = $1 OR s.to_user_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) { next(err); }
};

// ── GET /api/settlements/suggested ────────────────────────
// Pairwise debts (consistent with the dashboard IOUs): for each group and each
// counterparty, the net you owe them / they owe you, after folding in CONFIRMED
// payments. This is what you settle, person by person.
exports.getSuggested = async (req, res, next) => {
  try {
    const me = req.user.id;
    const { rows: groups } = await db.query(
      `SELECT g.id, g.name FROM groups g
       JOIN group_members gm ON gm.group_id = g.id
       WHERE gm.user_id = $1`,
      [me]
    );

    const out = [];

    for (const group of groups) {
      const { rows: expenses } = await db.query(
        'SELECT id, paid_by, amount FROM expenses WHERE group_id = $1', [group.id]
      );
      const { rows: splits } = await db.query(
        `SELECT es.expense_id, es.user_id, es.amount
         FROM expense_splits es JOIN expenses e ON e.id = es.expense_id
         WHERE e.group_id = $1`, [group.id]
      );
      const { rows: members } = await db.query(
        'SELECT user_id, name, initials FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE group_id = $1',
        [group.id]
      );
      const { rows: paid } = await db.query(
        `SELECT from_user_id, to_user_id, amount FROM settlements
         WHERE group_id = $1 AND status IN ${REDUCING}`, [group.id]
      );

      const expById = {};
      expenses.forEach(e => { expById[e.id] = e; });
      const memberOf = id => members.find(m => m.user_id === id);
      const meM = memberOf(me);

      // net[C] > 0  => I owe C ; < 0 => C owes me
      const net = {};
      for (const s of splits) {
        const e = expById[s.expense_id];
        if (!e || !e.paid_by) continue;
        const amt = parseFloat(s.amount);
        if (s.user_id === me && e.paid_by !== me)      net[e.paid_by] = (net[e.paid_by] || 0) + amt;
        else if (e.paid_by === me && s.user_id !== me) net[s.user_id] = (net[s.user_id] || 0) - amt;
      }
      for (const p of paid) {
        if (p.from_user_id === me && p.to_user_id !== me)      net[p.to_user_id]   = (net[p.to_user_id]   || 0) - parseFloat(p.amount);
        else if (p.to_user_id === me && p.from_user_id !== me) net[p.from_user_id] = (net[p.from_user_id] || 0) + parseFloat(p.amount);
      }

      for (const [C, value] of Object.entries(net)) {
        const amount = Math.round(Math.abs(value) * 100) / 100;
        if (amount <= 0.01) continue;
        const cM = memberOf(C);
        if (value > 0) {
          out.push({
            fromUserId: me, toUserId: C, amount,
            fromName: meM?.name || 'You', fromInitials: meM?.initials || 'ME',
            toName:   cM?.name || 'Unknown', toInitials: cM?.initials || '??',
            groupId: group.id, groupName: group.name, direction: 'owe',
          });
        } else {
          out.push({
            fromUserId: C, toUserId: me, amount,
            fromName: cM?.name || 'Unknown', fromInitials: cM?.initials || '??',
            toName:   meM?.name || 'You', toInitials: meM?.initials || 'ME',
            groupId: group.id, groupName: group.name, direction: 'owed',
          });
        }
      }
    }

    return res.json(out);
  } catch (err) { next(err); }
};

// ── GET /api/settlements/pending ──────────────────────────
exports.getPending = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT s.*,
              uf.name AS "fromName", uf.initials AS "fromInitials",
              ut.name AS "toName",   ut.initials AS "toInitials",
              g.name  AS "groupName"
       FROM settlements s
       JOIN users uf ON uf.id = s.from_user_id
       JOIN users ut ON ut.id = s.to_user_id
       LEFT JOIN groups g ON g.id = s.group_id
       WHERE s.status = 'pending' AND (s.from_user_id = $1 OR s.to_user_id = $1)
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    const toConfirm = rows.filter(r => r.to_user_id === req.user.id);
    const awaiting  = rows.filter(r => r.from_user_id === req.user.id);
    return res.json({ toConfirm, awaiting });
  } catch (err) { next(err); }
};

// ── POST /api/settlements ─────────────────────────────────
exports.createSettlement = async (req, res, next) => {
  try {
    const { toUserId, amount, groupId, paymentMethod, transactionId, notes } = req.body;
    const amt = parseFloat(amount);
    if (!toUserId)        return res.status(422).json({ error: 'Recipient is required' });
    if (!amt || amt <= 0) return res.status(422).json({ error: 'Enter a valid amount' });

    const { rows: [s] } = await db.query(
      `INSERT INTO settlements
         (from_user_id, to_user_id, amount, group_id, payment_method, transaction_id, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
      [req.user.id, toUserId, amt, groupId || null, paymentMethod || null, transactionId || null, notes || null]
    );

    let groupName = 'a group';
    if (groupId) {
      const { rows: g } = await db.query('SELECT name FROM groups WHERE id = $1', [groupId]);
      if (g[0]) groupName = g[0].name;
    }

    await createNotification(toUserId, {
      type:  'settlement',
      title: `${req.user.name} sent you a payment`,
      body:  `${req.user.name} paid KSh ${amt.toLocaleString()}${paymentMethod ? ` via ${paymentMethod}` : ''} in ${groupName}`
             + `${transactionId ? ` (Txn ${transactionId})` : ''}. Confirm or dispute it.`,
      data:  { settlementId: s.id, groupId: groupId || null, groupName, amount: amt,
               paymentMethod: paymentMethod || null, transactionId: transactionId || null,
               fromUserId: req.user.id, fromName: req.user.name, kind: 'payment_received' },
    });

    return res.status(201).json(s);
  } catch (err) { next(err); }
};

// ── PUT /api/settlements/:id/confirm ──────────────────────
exports.confirmSettlement = async (req, res, next) => {
  try {
    const { rows: [s] } = await db.query(
      `UPDATE settlements SET status = 'confirmed', paid_at = NOW()
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!s) return res.status(404).json({ error: 'Payment not found or not yours to confirm' });

    await createNotification(s.from_user_id, {
      type:  'settlement',
      title: `${req.user.name} confirmed your payment`,
      body:  `${req.user.name} confirmed receiving KSh ${parseFloat(s.amount).toLocaleString()}.`,
      data:  { settlementId: s.id, groupId: s.group_id, amount: s.amount, kind: 'payment_confirmed' },
    });

    return res.json(s);
  } catch (err) { next(err); }
};

// Back-compat alias: old clients called /:id/paid
exports.markPaid = exports.confirmSettlement;
