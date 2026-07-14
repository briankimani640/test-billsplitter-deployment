const db = require('../config/db');

// Build pairwise IOUs for a user, folding in CONFIRMED settlements so that
// partial payments reduce what shows on the dashboard.
async function fetchIOUs(userId) {
  const { rows: groups } = await db.query(
    `SELECT g.id, g.name FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1`,
    [userId]
  );

  const iOwe = [];
  const owedToMe = [];

  for (const group of groups) {
    const { rows: expenses } = await db.query(
      'SELECT id, paid_by, amount, description, date FROM expenses WHERE group_id = $1',
      [group.id]
    );
    const { rows: splits } = await db.query(
      `SELECT es.expense_id, es.user_id, es.amount
       FROM expense_splits es JOIN expenses e ON e.id = es.expense_id
       WHERE e.group_id = $1`,
      [group.id]
    );
    const { rows: members } = await db.query(
      'SELECT user_id, name, initials FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE group_id = $1',
      [group.id]
    );
    const { rows: paid } = await db.query(
      `SELECT from_user_id, to_user_id, amount FROM settlements
       WHERE group_id = $1 AND status = 'confirmed'`,
      [group.id]
    );

    const expById = {};
    expenses.forEach(e => { expById[e.id] = e; });
    const memberOf = id => members.find(m => m.user_id === id);

    // Gross pairwise + item breakdown
    const gross = {};   // gross[C] = { owe, owed, oweItems, owedItems }
    const bucket = (C) => (gross[C] || (gross[C] = { owe: 0, owed: 0, oweItems: [], owedItems: [] }));

    for (const s of splits) {
      const e = expById[s.expense_id];
      if (!e || !e.paid_by) continue;
      const share = parseFloat(s.amount);
      if (s.user_id === userId && e.paid_by !== userId) {
        const b = bucket(e.paid_by);
        b.owe += share;
        b.oweItems.push({ expenseId: e.id, description: e.description, amount: share, date: e.date });
      } else if (e.paid_by === userId && s.user_id !== userId) {
        const b = bucket(s.user_id);
        b.owed += share;
        b.owedItems.push({ expenseId: e.id, description: e.description, amount: share, date: e.date });
      }
    }

    // Confirmed payments adjust the pairwise nets
    for (const p of paid) {
      if (p.from_user_id === userId && p.to_user_id !== userId) {
        bucket(p.to_user_id).owe -= parseFloat(p.amount);          // I paid them down
      } else if (p.to_user_id === userId && p.from_user_id !== userId) {
        bucket(p.from_user_id).owed -= parseFloat(p.amount);       // they paid me down
      }
    }

    for (const [C, b] of Object.entries(gross)) {
      const net = b.owe - b.owed; // >0 : I owe C ; <0 : C owes me
      const m = memberOf(C);
      if (net > 0.01) {
        iOwe.push({
          personId: C, personName: m?.name || 'Unknown', personInitials: m?.initials || '??',
          groupName: group.name, groupId: group.id,
          totalAmount: Math.round(net * 100) / 100, items: b.oweItems,
        });
      } else if (net < -0.01) {
        owedToMe.push({
          personId: C, personName: m?.name || 'Unknown', personInitials: m?.initials || '??',
          groupName: group.name, groupId: group.id,
          totalAmount: Math.round(-net * 100) / 100, items: b.owedItems,
        });
      }
    }
  }

  iOwe.sort((a, b) => b.totalAmount - a.totalAmount);
  owedToMe.sort((a, b) => b.totalAmount - a.totalAmount);
  return { iOwe, owedToMe };
}

exports.listAll  = async (req, res, next) => { try { return res.json(await fetchIOUs(req.user.id)); } catch (e) { next(e); } };
exports.iOwe     = async (req, res, next) => { try { return res.json((await fetchIOUs(req.user.id)).iOwe); } catch (e) { next(e); } };
exports.owedToMe = async (req, res, next) => { try { return res.json((await fetchIOUs(req.user.id)).owedToMe); } catch (e) { next(e); } };
