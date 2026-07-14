const client = require('prom-client');

// ── Registry ──────────────────────────────────────────────
const register = new client.Registry();
register.setDefaultLabels({ app: 'splitkesh-api' });

// Default Node/process metrics (CPU, memory, event loop lag, GC, etc.)
client.collectDefaultMetrics({ register });

// ── Custom HTTP metrics ───────────────────────────────────
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Use the matched Express route pattern (e.g. /api/groups/:id) so that
// path params like UUIDs don't explode metric cardinality.
function routeLabel(req) {
  if (req.route && req.route.path) {
    return (req.baseUrl || '') + req.route.path;
  }
  // Unmatched (404s, etc.) — bucket together to avoid unbounded labels.
  return 'unmatched';
}

// Middleware: time every request and record it on finish.
function metricsMiddleware(req, res, next) {
  // Don't measure the scrape endpoint itself.
  if (req.path === '/metrics') return next();

  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = {
      method: req.method,
      route: routeLabel(req),
      status_code: res.statusCode,
    };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
}

// Handler for GET /metrics. Optionally protected by METRICS_TOKEN.
async function metricsHandler(req, res) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const provided = (req.headers.authorization || '').replace('Bearer ', '');
    if (provided !== token) return res.status(401).end('Unauthorized');
  }
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler, register };
