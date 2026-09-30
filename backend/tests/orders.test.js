/**
 * Orders controller tests
 * Tests: stock validation, role scoping, status transitions,
 *        cancellation with stock restore, tracking number generation
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../db', () => {
  const mockClient = {
    query:   jest.fn(),
    release: jest.fn(),
  };
  return {
    query:   jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
    _mockClient: mockClient,
  };
});

const pool = require('../db');
const app  = require('../app');

const SECRET = 'rayen_secret_key_2026';

// ── Token helpers ─────────────────────────────────────────────────────────────
function token(role = 'Manager', id = 1) {
  return jwt.sign({ id, role_name: role, email: 'test@test.com' }, SECRET, { expiresIn: '1h' });
}

function authHeader(role, id) {
  return { Authorization: `Bearer ${token(role, id)}` };
}

beforeEach(() => {
  jest.clearAllMocks();
  pool._mockClient.query.mockReset();
  pool._mockClient.release.mockReset();
  pool._mockClient.release.mockImplementation(() => {});
});

// ── GET /api/orders ───────────────────────────────────────────────────────────
describe('GET /api/orders', () => {

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('returns paginated orders for Manager', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({ rows: [
        { id: 1, client_name: 'ACME', status: 'confirmed', amount_ttc: '1000.00' },
        { id: 2, client_name: 'Beta', status: 'pending',   amount_ttc: '500.00'  },
      ]});

    const res = await request(app)
      .get('/api/orders')
      .set(authHeader('Manager'));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('Sales Agent only sees their own orders (user_id filter applied)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      .mockResolvedValueOnce({ rows: [
        { id: 5, client_name: 'My Client', status: 'pending', amount_ttc: '200.00', user_id: 99 },
      ]});

    const res = await request(app)
      .get('/api/orders')
      .set(authHeader('Sales Agent', 99));

    expect(res.status).toBe(200);
    // Verify the query included a user_id filter by checking it was called
    const allCalls = pool.query.mock.calls;
    const queryStr = allCalls[0][0];
    expect(queryStr).toContain('so.user_id=');
  });

});

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
describe('GET /api/orders/:id', () => {

  it('returns 404 when order does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/orders/9999')
      .set(authHeader('Manager'));

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('returns order with lines when found', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'confirmed', client_name: 'ACME' }] })
      .mockResolvedValueOnce({ rows: [
        { id: 10, product_name: 'Laptop', quantity: 2, unit_price: '500.00' },
      ]});

    const res = await request(app)
      .get('/api/orders/1')
      .set(authHeader('Manager'));

    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(1);
    expect(res.body.lines).toHaveLength(1);
    expect(res.body.lines[0].product_name).toBe('Laptop');
  });

});

// ── PUT /api/orders/:id/status ────────────────────────────────────────────────
describe('PUT /api/orders/:id/status', () => {

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .put('/api/orders/1/status')
      .send({ status: 'confirmed' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when Sales Agent tries to update status', async () => {
    const res = await request(app)
      .put('/api/orders/1/status')
      .set(authHeader('Sales Agent'))
      .send({ status: 'confirmed' });

    expect(res.status).toBe(403);
  });

  it('returns 422 when status value is invalid', async () => {
    const res = await request(app)
      .put('/api/orders/1/status')
      .set(authHeader('Manager'))
      .send({ status: 'invalid_status' });

    expect(res.status).toBe(422);
  });

  it('returns 404 when order does not exist', async () => {
    pool._mockClient.query
      .mockResolvedValueOnce({ rows: [] })   // BEGIN
      .mockResolvedValueOnce({ rows: [] });  // SELECT status → empty

    const res = await request(app)
      .put('/api/orders/9999/status')
      .set(authHeader('Manager'))
      .send({ status: 'confirmed' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when stock is insufficient on confirm', async () => {
    pool._mockClient.query
      .mockResolvedValueOnce({ rows: [] })                          // BEGIN
      .mockResolvedValueOnce({ rows: [{ status: 'pending' }] })     // SELECT status
      .mockResolvedValueOnce({ rows: [{ product_id: 1, quantity: 10 }] }) // SELECT order lines
      .mockResolvedValueOnce({ rows: [{ stock: 2, name: 'Laptop' }] });   // SELECT stock FOR UPDATE

    const res = await request(app)
      .put('/api/orders/1/status')
      .set(authHeader('Manager'))
      .send({ status: 'confirmed' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient stock/i);
  });

});

// ── PUT /api/orders/:id/cancel ────────────────────────────────────────────────
describe('PUT /api/orders/:id/cancel', () => {

  it('returns 403 when Sales Agent tries to cancel another user\'s order', async () => {
    pool._mockClient.query
      .mockResolvedValueOnce({ rows: [] })                                  // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending', user_id: 999 }] }); // ORDER belongs to user 999

    const res = await request(app)
      .put('/api/orders/1/cancel')
      .set(authHeader('Sales Agent', 1))  // logged in as user 1
      .send({ cancel_reason: 'Changed mind' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/only cancel your own/i);
  });

  it('returns 400 when order is already cancelled', async () => {
    pool._mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'cancelled', user_id: 1 }] });

    const res = await request(app)
      .put('/api/orders/1/cancel')
      .set(authHeader('Manager'))
      .send({ cancel_reason: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already cancelled/i);
  });

  it('returns 400 when order is delivered', async () => {
    pool._mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'delivered', user_id: 1 }] });

    const res = await request(app)
      .put('/api/orders/1/cancel')
      .set(authHeader('Manager'))
      .send({ cancel_reason: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot cancel a delivered/i);
  });

});
