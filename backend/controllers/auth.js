const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');

const { handleValidationErrors, writeAuditLog } = require('./shared');
const { sendPasswordResetEmail } = require('../email');

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

const registerUser = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { firstname, lastname, email, password, role_id } = req.body;
    const existing = await pool.query('SELECT id FROM app_user WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO app_user (firstname,lastname,email,password_hash,status,last_login,role_id)
       VALUES ($1,$2,$3,$4,'active',NULL,$5) RETURNING id,firstname,lastname,email,status,role_id`,
      [firstname, lastname, email, hashedPassword, role_id]
    );
    res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const loginUser = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      `SELECT u.id,u.firstname,u.lastname,u.email,u.password_hash,u.status,u.role_id,r.name AS role_name
       FROM app_user u LEFT JOIN role r ON u.role_id=r.id WHERE u.email=$1`, [email]
    );
    if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid email or password' });
    const user = result.rows[0];
    if (user.status !== 'active') return res.status(403).json({ message: 'User account is not active' });
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) return res.status(401).json({ message: 'Invalid email or password' });
    await pool.query('UPDATE app_user SET last_login=NOW() WHERE id=$1', [user.id]);
    await writeAuditLog(user.id, 'LOGIN', `Login successful — ${user.email}`);
    const token = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id, role_name: user.role_name },
      process.env.JWT_SECRET, { expiresIn: '1d' }
    );
    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, firstname: user.firstname, lastname: user.lastname, email: user.email, status: user.status, role_id: user.role_id, role_name: user.role_name }
    });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const forgotPassword = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { email } = req.body;
    const result = await pool.query(
      'SELECT id, firstname, lastname, email FROM app_user WHERE email=$1 AND status=$2',
      [email, 'active']
    );

    // Always respond with the same generic message, whether or not the
    // email matches an account — avoids leaking which emails are registered.
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await pool.query(
        'UPDATE app_user SET reset_token_hash=$1, reset_token_expires=$2 WHERE id=$3',
        [tokenHash, expiresAt, user.id]
      );

      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail({
        toEmail: user.email,
        toName: `${user.firstname} ${user.lastname}`,
        resetUrl,
      });
      await writeAuditLog(user.id, 'PASSWORD_RESET_REQUESTED', `Password reset requested for ${user.email}`);
    }

    res.json({ message: 'If that email is registered, a password reset link has been sent to it.' });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const resetPassword = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { token, password } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await pool.query(
      'SELECT id, email FROM app_user WHERE reset_token_hash=$1 AND reset_token_expires > NOW()',
      [tokenHash]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const user = result.rows[0];
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE app_user SET password_hash=$1, reset_token_hash=NULL, reset_token_expires=NULL WHERE id=$2',
      [hashedPassword, user.id]
    );
    await writeAuditLog(user.id, 'PASSWORD_RESET', `Password reset completed for ${user.email}`);

    res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

module.exports = { registerUser, loginUser, forgotPassword, resetPassword };

