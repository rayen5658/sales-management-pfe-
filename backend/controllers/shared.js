const { validationResult } = require('express-validator');
const { TVA_RATE } = require('../constants');

const mapDbErrorToHttp = (err) => {
  const raw = err && (err.message || err.toString) ? String(err.message || err.toString()) : '';
  const msg = raw.toLowerCase();

  // Postgres invalid input / type coercion (e.g. "abc" for numeric)
  if (msg.includes('invalid input syntax')) {
    return { status: 422, body: { message: 'Invalid request payload' } };
  }

  // Express-validator: invalid fields still sometimes hit DB casts in other endpoints
  if (msg.includes('invalid input syntax for type') || msg.includes('invalid input')) {
    return { status: 422, body: { message: 'Invalid request payload' } };
  }

  // Generic not-null / constraint failures triggered by malformed payloads
  if (msg.includes('null value in column') || msg.includes('violates not-null constraint')) {
    return { status: 422, body: { message: 'Invalid request payload' } };
  }

  return null;
};

const handleControllerError = (res, error, fallbackStatus = 500) => {
  try {
    const mapped = mapDbErrorToHttp(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);

    return res.status(fallbackStatus).json({ message: 'Internal server error' });
  } catch (_) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Validation helper for controllers that use express-validator middleware.
// Returns true and sends a 422 response if there are validation errors.
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
    return true;
  }
  return false;
};

// HELPER — write audit log (used internally)
const writeAuditLog = async (pool, user_id, action, details) => {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, details, timestamp) VALUES ($1, $2, $3, NOW())',
      [user_id, action, details]
    );
  } catch (_) {
    /* non-blocking */
  }
};

module.exports = {
  TVA_RATE,
  mapDbErrorToHttp,
  handleControllerError,
  handleValidationErrors,
  writeAuditLog,
};

