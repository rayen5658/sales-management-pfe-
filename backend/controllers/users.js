const pool = require('../db');

const bcrypt = require('bcryptjs');

const { handleValidationErrors, writeAuditLog } = require('./shared');

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id,u.firstname,u.lastname,u.email,u.status,u.last_login,u.role_id,r.name AS role_name
       FROM app_user u LEFT JOIN role r ON u.role_id=r.id ORDER BY u.id ASC`
    );
    res.json(result.rows);
  } catch (error) { console.error('getAllUsers:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const getAllRoles = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM role ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) { console.error('getAllRoles:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const updateUser = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { firstname, lastname, email, role_id, status } = req.body;
    const result = await pool.query(
      `UPDATE app_user SET firstname=$1,lastname=$2,email=$3,role_id=$4,status=$5 WHERE id=$6
       RETURNING id,firstname,lastname,email,role_id,status`,
      [firstname, lastname, email, role_id, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) { console.error('updateUser:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE app_user SET status=$1 WHERE id=$2 RETURNING id,firstname,lastname,email,status',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    await writeAuditLog(req.user?.id, 'USER_STATUS_CHANGE', `User #${id} — status changed to "${status}"`);
    res.json(result.rows[0]);
  } catch (error) { console.error('toggleUserStatus:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('UPDATE app_user SET password_hash=$1 WHERE id=$2', [hashed, id]);
    await writeAuditLog(req.user?.id, 'PASSWORD_RESET', `Password reset for user #${id}`);
    res.json({ message: 'Password reset successfully' });
  } catch (error) { console.error('resetUserPassword:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    // Prevent admin from deleting their own account
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    const result = await pool.query('DELETE FROM app_user WHERE id=$1 RETURNING id,email', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    await writeAuditLog(req.user?.id, 'USER_DELETE', `User deleted — #${id} (${result.rows[0].email})`);
    res.json({ message: 'User deleted' });
  } catch (error) { console.error('deleteUser:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

module.exports = {
  getAllUsers,
  getAllRoles,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
};

