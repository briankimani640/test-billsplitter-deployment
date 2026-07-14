const cron = require('node-cron');
const db   = require('../config/db');
const mail = require('../utils/email');
const { createNotification, prefEnabled } = require('../utils/notify');

// Build the list of who-owes-whom from pending balances and create
// a reminder notification (+ email) for each debtor, once per run.
async function runPaymentReminders() {
  console.log('⏰ Running payment reminders…');
  try {
    // Pending settlements that are still unpaid and older than 1 day
    const { rows } = await db.query(
      `SELECT s.id, s.amount, s.group_id,
              df.id AS debtor_id, df.name AS debtor_name, df.email AS debtor_email, df.preferences AS debtor_prefs,
              ct.name AS creditor_name,
              g.name  AS group_name
       FROM settlements s
       JOIN users df ON df.id = s.from_user_id
       JOIN users ct ON ct.id = s.to_user_id
       LEFT JOIN groups g ON g.id = s.group_id
       WHERE s.status = 'pending'
         AND s.created_at <= NOW() - INTERVAL '1 day'`
    );

    let sent = 0;
    for (const r of rows) {
      // Skip if a reminder for this settlement was already sent in the last 3 days
      const { rows: existing } = await db.query(
        `SELECT 1 FROM notifications
         WHERE user_id = $1 AND type = 'payment_reminder'
           AND data->>'settlementId' = $2
           AND created_at >= NOW() - INTERVAL '3 days' LIMIT 1`,
        [r.debtor_id, r.id]
      );
      if (existing.length) continue;

      await createNotification(r.debtor_id, {
        type:  'payment_reminder',
        title: `Reminder: you owe ${r.creditor_name}`,
        body:  `You owe ${r.creditor_name} KSh ${r.amount}${r.group_name ? ` in "${r.group_name}"` : ''}.`,
        data:  { settlementId: r.id, groupId: r.group_id, amount: r.amount },
      });

      // Email only if the user hasn't opted out
      if (prefEnabled(r.debtor_prefs, 'notifyPaymentReminders') &&
          prefEnabled(r.debtor_prefs, 'notifyEmail')) {
        mail.sendPaymentReminderEmail(r.debtor_email, r.debtor_name, {
          fromName: r.creditor_name, amount: r.amount, groupName: r.group_name,
        });
      }
      sent++;
    }
    console.log(`⏰ Payment reminders done — ${sent} sent.`);
  } catch (err) {
    console.error('❌ Payment reminder job failed:', err.message);
  }
}

function startJobs() {
  // Default: every day at 09:00 server time. Override with REMINDER_CRON.
  const schedule = process.env.REMINDER_CRON || '0 9 * * *';
  if (!cron.validate(schedule)) {
    console.warn(`⚠️  Invalid REMINDER_CRON "${schedule}" — reminders disabled.`);
    return;
  }
  cron.schedule(schedule, runPaymentReminders);
  console.log(`⏰ Payment reminder job scheduled (${schedule}).`);
}

module.exports = { startJobs, runPaymentReminders };
