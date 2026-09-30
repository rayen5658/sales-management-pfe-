/**
 * Middleware tests — verifyToken and authorizeRoles
 * Tests: missing token, invalid token, client portal token rejection,
 *        valid token, role authorization
 */

const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { verifyToken, authorizeRoles } = require('../middleware');

const SECRET = process.env.JWT_SECRET || 'rayen_secret_key_2026';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeToken(payload, secret = SECRET) {
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

function mockReq(token) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

// ── verifyToken ───────────────────────────────────────────────────────────────
describe('verifyToken middleware', () => {

  it('returns 401 when no Authorization header is present', () => {
    const req  = mockReq(null);
    const res  = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is malformed', () => {
    const req  = mockReq('not.a.valid.jwt');
    const res  = mockRes();
    const next = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is signed with wrong secret', () => {
    const token = makeToken({ id: 1, role_name: 'Manager' }, 'wrong_secret');
    const req   = mockReq(token);
    const res   = mockRes();
    const next  = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 and blocks client portal tokens from staff endpoints', () => {
    const token = makeToken({ id: 5, email: 'client@test.com', client_portal: true });
    const req   = mockReq(token);
    const res   = mockRes();
    const next  = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and populates req.user when token is valid', () => {
    const payload = { id: 1, email: 'admin@test.com', role_name: 'Administrator' };
    const token   = makeToken(payload);
    const req     = mockReq(token);
    const res     = mockRes();
    const next    = jest.fn();

    verifyToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject({ id: 1, role_name: 'Administrator' });
  });

  it('does not call next() for an expired token', () => {
    const token = jwt.sign({ id: 1, role_name: 'Manager' }, SECRET, { expiresIn: '-1s' });
    const req   = mockReq(token);
    const res   = mockRes();
    const next  = jest.fn();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

});

// ── authorizeRoles ────────────────────────────────────────────────────────────
describe('authorizeRoles middleware', () => {

  it('returns 403 when user role is not in allowed list', () => {
    const req  = { user: { role_name: 'Sales Agent' } };
    const res  = mockRes();
    const next = jest.fn();

    authorizeRoles('Administrator', 'Manager')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user role is in allowed list', () => {
    const req  = { user: { role_name: 'Manager' } };
    const res  = mockRes();
    const next = jest.fn();

    authorizeRoles('Administrator', 'Manager')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when req.user is missing', () => {
    const req  = {};
    const res  = mockRes();
    const next = jest.fn();

    authorizeRoles('Administrator')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows Administrator role when specified', () => {
    const req  = { user: { role_name: 'Administrator' } };
    const res  = mockRes();
    const next = jest.fn();

    authorizeRoles('Administrator')(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects Sales Agent from Administrator-only route', () => {
    const req  = { user: { role_name: 'Sales Agent' } };
    const res  = mockRes();
    const next = jest.fn();

    authorizeRoles('Administrator')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

});
