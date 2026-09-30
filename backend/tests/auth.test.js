/**
 * Auth controller tests — login and token generation
 * Tests: input validation, wrong credentials, inactive account, successful login
 */

const request = require('supertest');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

// ── Mock the DB pool before importing app ────────────────────────────────────
jest.mock('../db', () => ({
  query:   jest.fn(),
  connect: jest.fn(),
}));

const pool = require('../db');
const app  = require('../app');

const SECRET = 'rayen_secret_key_2026';

// ── Shared test data ─────────────────────────────────────────────────────────
const PASSWORD = 'Test1234!';
let   PASSWORD_HASH;

beforeAll(async () => {
  PASSWORD_HASH = await bcrypt.hash(PASSWORD, 10);
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Helper: build a DB user row ───────────────────────────────────────────────
const makeUser = (overrides = {}) => ({
  id:            1,
  firstname:     'John',
  lastname:      'Doe',
  email:         'john@example.com',
  password_hash: PASSWORD_HASH,
  status:        'active',
  role_id:       1,
  role_name:     'Administrator',
  ...overrides,
});

describe('POST /api/auth/login', () => {

  it('returns 422 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: PASSWORD });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/validation failed/i);
  });

  it('returns 422 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/validation failed/i);
  });

  it('returns 422 when email format is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: PASSWORD });

    expect(res.status).toBe(422);
  });

  it('returns 401 when user does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@example.com', password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('returns 401 when password is wrong', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeUser()] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it('returns 403 when user account is inactive', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeUser({ status: 'inactive' })] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not active/i);
  });

  it('returns 200 with a valid JWT on successful login', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeUser()] })  // user lookup
      .mockResolvedValueOnce({ rows: [] })             // UPDATE last_login
      .mockResolvedValueOnce({ rows: [] });            // audit log insert

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('john@example.com');
    expect(res.body.user.role_name).toBe('Administrator');

    // Verify the JWT is valid and contains expected claims
    const decoded = jwt.verify(res.body.token, SECRET);
    expect(decoded.id).toBe(1);
    expect(decoded.role_name).toBe('Administrator');
  });

  it('returned user object does not expose password_hash', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [makeUser()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: PASSWORD });

    expect(res.body.user.password_hash).toBeUndefined();
  });

});
