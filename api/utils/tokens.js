const crypto = require('crypto');
const db     = require('../config/db');

// Generate a URL-safe random token and its SHA-256 hash.
// We email the raw token but only ever store the hash.
function generateToken() {
  const raw  = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Create + persist a token row. type = 'verify' | 'reset'
async function issueToken(userId, type, ttlMinutes) {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // Invalidate previous unused tokens of the same type for this user
  await db.query(
    `UPDATE email_tokens SET used_at = NOW()
     WHERE user_id = $1 AND type = $2 AND used_at IS NULL`,
    [userId, type]
  );

  await db.query(
    `INSERT INTO email_tokens (user_id, token_hash, type, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, hash, type, expiresAt]
  );

  return raw;
}

// Look up a valid (unused, unexpired) token. Returns the row or null.
async function consumeToken(raw, type) {
  const hash = hashToken(raw);
  const { rows } = await db.query(
    `SELECT * FROM email_tokens
     WHERE token_hash = $1 AND type = $2
       AND used_at IS NULL AND expires_at > NOW()`,
    [hash, type]
  );
  if (!rows.length) return null;

  await db.query('UPDATE email_tokens SET used_at = NOW() WHERE id = $1', [rows[0].id]);
  return rows[0];
}

module.exports = { generateToken, hashToken, issueToken, consumeToken };
