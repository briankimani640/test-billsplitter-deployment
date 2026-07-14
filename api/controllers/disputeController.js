const db = require('../config/db');
const { createNotification } = require('../utils/notify');

const REASONS = {
  money_not_received:  'Money not received',
  fake_transaction_id: 'Fake transaction ID',
  incomplete_amount:   'Incomplete amount',
  other:               'Other',
};

// ── GET /api/disputes ─────────────────────────────────────
exports.listDisputes = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT d.*,
              ur.name AS "raisedByName", ur.initials AS "raisedByInitials",
              ua.name AS "againstName",  ua.initials AS "againstInitials",
              g.name  AS "groupName",
              s.payment_method AS "paymentMethod", s.transaction_id AS "transactionId"
       FROM disputes d
       JOIN users ur ON ur.id = d.raised_by
       JOIN users ua ON ua.id = d.against_user
       LEFT JOIN groups g      ON g.id = d.group_id
       LEFT JOIN settlements s ON s.id = d.settlement_id
       WHERE d.raised_by = $1 OR d.against_user = $1
       ORDER BY (d.status = 'open') DESC, d.created_at DESC`,
      [req.user.id]
    );
    return res.json(rows.map(d => ({ ...d, reasonLabel: REASONS[d.reason] || d.reason })));
  } catch (err) { next(err); }
};

// ── POST /api/disputes ────────────────────────────────────
// Raised by the person who was owed, against the payer, over a recorded payment.
exports.createDispute = async (req, res, next) => {
  try {
    const { settlementId, reason, note } = req.body;
    if (!settlementId)          return res.status(422).json({ error: 'A payment is required to dispute' });
    if (!REASONS[reason])       return res.status(422).json({ error: 'Choose a valid reason' });

    // The current user must be the recipient of that payment.
    const { rows: [s] } = await db.query(
      'SELECT * FROM settlements WHERE id = $1 AND to_user_id = $2',
      [settlementId, req.user.id]
    );
    if (!s) return res.status(404).json({ error: 'Payment not found or not yours to dispute' });

    const { rows: [d] } = await db.query(
      `INSERT INTO disputes (settlement_id, raised_by, against_user, group_id, amount, reason, note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'open') RETURNING *`,
      [settlementId, req.user.id, s.from_user_id, s.group_id, s.amount, reason, note || null]
    );

    await db.query(`UPDATE settlements SET status = 'disputed' WHERE id = $1`, [settlementId]);

    await createNotification(s.from_user_id, {
      type:  'dispute',
      title: `${req.user.name} disputed your payment`,
      body:  `Reason: ${REASONS[reason]}${note ? ` — “${note}”` : ''}. Only ${req.user.name} can resolve it.`,
      data:  { disputeId: d.id, settlementId, groupId: s.group_id, amount: s.amount, reason },
    });

    return res.status(201).json({ ...d, reasonLabel: REASONS[reason] });
  } catch (err) { next(err); }
};

// ── PUT /api/disputes/:id/resolve ─────────────────────────
// Only whoever raised the dispute can resolve it.
exports.resolveDispute = async (req, res, next) => {
  try {
    const { rows: [d] } = await db.query(
      `UPDATE disputes SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1 AND raised_by = $2 AND status = 'open'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!d) return res.status(404).json({ error: 'Dispute not found or not yours to resolve' });

    // Resolving accepts the payment as valid, so the settlement is confirmed.
    if (d.settlement_id) {
      await db.query(`UPDATE settlements SET status = 'confirmed', paid_at = NOW() WHERE id = $1`, [d.settlement_id]);
    }

    await createNotification(d.against_user, {
      type:  'dispute',
      title: `${req.user.name} resolved the dispute`,
      body:  `The dispute over KSh ${parseFloat(d.amount || 0).toLocaleString()} has been resolved.`,
      data:  { disputeId: d.id, settlementId: d.settlement_id, groupId: d.group_id },
    });

    return res.json(d);
  } catch (err) { next(err); }
};
