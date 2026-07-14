const nodemailer = require('nodemailer');

const APP_NAME  = 'SplitKesh';
const CLIENT    = process.env.CLIENT_URL || 'http://localhost:3000';
const FROM      = process.env.MAIL_FROM  || 'SplitKesh <no-reply@splitkesh.app>';

// ── Transport ─────────────────────────────────────────────
// Real SMTP when SMTP_HOST is configured; otherwise a console
// fallback so the flows still work in local dev without a server.
let transporter = null;
let usingSmtp   = false;

if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
    auth:   process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  usingSmtp = true;
} else {
  // Dev fallback — "sends" by logging to the console.
  transporter = {
    sendMail: async (opts) => {
      console.log('\n📧 [DEV EMAIL — configure SMTP_* to send for real]');
      console.log('   To:      ', opts.to);
      console.log('   Subject: ', opts.subject);
      console.log('   Text:    ', (opts.text || '').replace(/\n/g, '\n            '));
      console.log('');
      return { messageId: 'dev-' + Date.now() };
    },
  };
}

async function send({ to, subject, text, html }) {
  try {
    return await transporter.sendMail({ from: FROM, to, subject, text, html });
  } catch (err) {
    // Never let a mail failure break the request flow — log and move on.
    console.error('❌ Email send failed:', err.message);
    return null;
  }
}

// ── Templated emails ──────────────────────────────────────
function shell(title, bodyHtml) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a2e">
    <h2 style="color:#7c5cfc">${APP_NAME}</h2>
    <h3>${title}</h3>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="font-size:12px;color:#888">You received this because someone used your email on ${APP_NAME}. If this wasn't you, you can ignore it.</p>
  </div>`;
}

exports.sendVerificationEmail = (to, name, token) => {
  const link = `${CLIENT}/verify-email?token=${token}`;
  return send({
    to,
    subject: `Verify your ${APP_NAME} email`,
    text: `Hi ${name},\n\nVerify your email by opening this link:\n${link}\n\nThis link expires in 24 hours.`,
    html: shell('Verify your email', `<p>Hi ${name},</p>
      <p>Tap the button to verify your email address.</p>
      <p><a href="${link}" style="display:inline-block;background:#7c5cfc;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Verify email</a></p>
      <p style="font-size:13px;color:#666">This link expires in 24 hours.</p>`),
  });
};

exports.sendPasswordResetEmail = (to, name, token) => {
  const link = `${CLIENT}/reset-password?token=${token}`;
  return send({
    to,
    subject: `Reset your ${APP_NAME} password`,
    text: `Hi ${name},\n\nReset your password using this link:\n${link}\n\nThis link expires in 60 minutes. If you didn't request this, ignore this email.`,
    html: shell('Reset your password', `<p>Hi ${name},</p>
      <p>We got a request to reset your password.</p>
      <p><a href="${link}" style="display:inline-block;background:#7c5cfc;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Reset password</a></p>
      <p style="font-size:13px;color:#666">This link expires in 60 minutes. Didn't request it? You can safely ignore this email.</p>`),
  });
};

exports.sendPasswordChangedEmail = (to, name) => {
  return send({
    to,
    subject: `Your ${APP_NAME} password was changed`,
    text: `Hi ${name},\n\nThis is a confirmation that your password was just changed. If this wasn't you, reset your password immediately and contact support.`,
    html: shell('Password changed', `<p>Hi ${name},</p>
      <p>This is a confirmation that your password was just changed.</p>
      <p style="font-size:13px;color:#c0392b"><strong>Wasn't you?</strong> Reset your password right away from the login screen.</p>`),
  });
};

exports.sendPaymentReminderEmail = (to, name, { fromName, amount, groupName }) => {
  return send({
    to,
    subject: `Payment reminder — ${APP_NAME}`,
    text: `Hi ${name},\n\nReminder: you owe ${fromName} KSh ${amount}${groupName ? ` in "${groupName}"` : ''}. Open SplitKesh to settle up.`,
    html: shell('Payment reminder', `<p>Hi ${name},</p>
      <p>Friendly reminder that you owe <strong>${fromName}</strong> <strong>KSh ${amount}</strong>${groupName ? ` in <em>${groupName}</em>` : ''}.</p>
      <p><a href="${CLIENT}/settlement" style="display:inline-block;background:#7c5cfc;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Settle up</a></p>`),
  });
};

exports.usingSmtp = () => usingSmtp;
