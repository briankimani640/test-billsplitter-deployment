const db = require('../config/db');

// Lightweight request monitor: logs method/path/status/latency to
// the console and (best-effort, async) to the request_logs table.
// Skips noisy paths like the health check and static uploads.
const SKIP = [/^\/api\/health/, /^\/uploads\//];

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const ms = Math.round(durationMs);

    const tag = res.statusCode >= 500 ? '🔴' : res.statusCode >= 400 ? '🟡' : '🟢';
    console.log(`${tag} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);

    if (SKIP.some(re => re.test(req.path))) return;

    // Best-effort persistence — never block or throw on logging.
    db.query(
      `INSERT INTO request_logs (method, path, status, duration_ms, user_id, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.method,
        req.originalUrl.slice(0, 255),
        res.statusCode,
        ms,
        req.user?.id || null,
        (req.headers['x-forwarded-for'] || req.ip || '').toString().slice(0, 64),
      ]
    ).catch(() => { /* table may not exist yet pre-migration — ignore */ });
  });

  next();
}

module.exports = requestLogger;
