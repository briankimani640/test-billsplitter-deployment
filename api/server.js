require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const { errorHandler } = require('./middleware/errorHandler');
const requestLogger    = require('./middleware/requestLogger');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');
const { startJobs }    = require('./jobs/paymentReminders');
const swaggerUi        = require('swagger-ui-express');
const swaggerSpec      = require('./docs/swagger');
const db               = require('./config/db');

const app = express();

// ── Ensure uploads folder exists ──────────────────────────
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Middleware ────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Monitoring (request logging + Prometheus metrics) ─────
app.use(requestLogger);
app.use(metricsMiddleware);

// Prometheus scrape endpoint
app.get('/metrics', metricsHandler);

// ── Static file serving (receipt images) ─────────────────
app.use('/uploads', express.static(uploadDir));

// ── Health check (with DB ping) ───────────────────────────
app.get('/api/health', async (_req, res) => {
  let dbOk = false;
  try { await db.query('SELECT 1'); dbOk = true; } catch { /* db down */ }
  res.status(dbOk ? 200 : 503).json({
    status:    dbOk ? 'ok' : 'degraded',
    db:        dbOk ? 'up' : 'down',
    uptime:    Math.round(process.uptime()),
    timestamp: new Date(),
  });
});

// ── Routes ────────────────────────────────────────────────
// ── API documentation (Swagger UI) ──
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'SplitKesh API Docs',
  swaggerOptions: { persistAuthorization: true },
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/groups',        require('./routes/groups'));
app.use('/api/expenses',      require('./routes/expenses'));
app.use('/api/ious',          require('./routes/ious'));
app.use('/api/settlements',   require('./routes/settlements'));
app.use('/api/disputes',      require('./routes/disputes'));
app.use('/api/stats',         require('./routes/stats'));
app.use('/api/ocr',           require('./routes/ocr'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin',         require('./routes/admin'));

// ── 404 handler ───────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════╗
  ║   SplitKesh API  🚀  Port ${PORT}       ║
  ╠══════════════════════════════════════╣
  ║  Health:  http://localhost:${PORT}/api/health
  ║  Env:     ${process.env.NODE_ENV || 'development'}
  ╚══════════════════════════════════════╝
  `);
    startJobs(); // schedule payment-reminder cron
  });
}

module.exports = app;
