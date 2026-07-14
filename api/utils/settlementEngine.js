/**
 * Settlement Engine
 * Calculates the minimum number of transactions needed
 * to settle all debts within a group.
 */

/**
 * Given a map of { userId: netBalance }
 * (positive = owed money, negative = owes money),
 * returns the minimum set of payments needed.
 */
function calculateMinSettlements(balances) {
  // Split into creditors (get money) and debtors (owe money)
  const creditors = [];
  const debtors   = [];

  for (const [userId, balance] of Object.entries(balances)) {
    const rounded = Math.round(balance * 100) / 100;
    if (rounded >  0.01) creditors.push({ userId, amount:  rounded });
    if (rounded < -0.01) debtors.push({ userId,   amount: -rounded });
  }

  // Sort descending by amount for greedy matching
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let i = 0, j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    const rounded = Math.round(amount * 100) / 100;

    if (rounded > 0.01) {
      settlements.push({
        fromUserId: debtors[i].userId,
        toUserId:   creditors[j].userId,
        amount:     rounded,
      });
    }

    debtors[i].amount   -= amount;
    creditors[j].amount -= amount;

    if (debtors[i].amount   < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  return settlements;
}

/**
 * From a list of expense splits, calculate each member's net balance.
 * paidBy receives credit; splits are debts.
 */
function calcGroupBalances(expenses, splits) {
  const balances = {};

  // Credit the payer for the full expense amount
  for (const e of expenses) {
    if (!e.paid_by) continue;
    balances[e.paid_by] = (balances[e.paid_by] || 0) + parseFloat(e.amount);
  }

  // Debit each member their share
  for (const s of splits) {
    balances[s.user_id] = (balances[s.user_id] || 0) - parseFloat(s.amount);
  }

  return balances;
}

module.exports = { calculateMinSettlements, calcGroupBalances };
