const db = require('../config/db');

// Create an in-app notification. Returns the created row.
// Respects per-user preference flags where applicable.
async function createNotification(userId, { type, title, body = null, data = {} }) {
  try {
    const { rows } = await db.query(
      `INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING *`,
      [userId, type, title, body, JSON.stringify(data)]
    );
    return rows[0];
  } catch (err) {
    console.error('❌ createNotification failed:', err.message);
    return null;
  }
}

// Check a boolean preference (defaults to true when unset).
function prefEnabled(preferences, key) {
  if (!preferences || !(key in preferences)) return true;
  return preferences[key] !== false;
}

module.exports = { createNotification, prefEnabled };
