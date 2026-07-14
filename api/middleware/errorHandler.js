const { validationResult } = require('express-validator');

// ── Run express-validator checks and return 422 on failure ─
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
};

// ── Central error handler (last middleware in server.js) ───
const errorHandler = (err, req, res, next) => {
  console.error('❌', err.message);

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Record already exists' });
  }
  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { validate, errorHandler };
