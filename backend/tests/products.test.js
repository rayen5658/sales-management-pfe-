/**
 * Products controller tests
 * Tests: CRUD access control, validation, 404 handling
 */

const request = require('supertest');
const jwt     = require('jsonwebtoken');

jest.mock('../db', () => ({
  query:   jest.fn(),
  connect: jest.fn(),
}));

const pool = require('../db');
const app  = require('../app');

const SECRET = 'rayen_secret_key_2026';

function token(role = 'Manager', id = 1) {
  return jwt.sign({ id, role_name: role, email: 'test@test.com' }, SECRET, { expiresIn: '1h' });
}
function auth(role, id) {
  return { Authorization: `Bearer ${token(role, id)}` };
}

beforeEach(() => jest.resetAllMocks());

// ── GET /api/products ─────────────────────────────────────────────────────────
describe('GET /api/products', () => {

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('returns paginated product list for authenticated user', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: '2' }] })
      .mockResolvedValueOnce({ rows: [
        { id: 1, name: 'Laptop HP', stock: 10, unit_price: '1200.00' },
        { id: 2, name: 'Mouse',     stock: 50, unit_price: '25.00'   },
      ]});

    const res = await request(app)
      .get('/api/products')
      .set(auth('Sales Agent'));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

});

// ── POST /api/products ────────────────────────────────────────────────────────
describe('POST /api/products', () => {

  it('returns 403 when Sales Agent tries to create a product', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth('Sales Agent'))
      .send({ name: 'New Product', unit_price: 100, stock: 5 });

    expect(res.status).toBe(403);
  });

  it('returns 422 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth('Manager'))
      .send({ name: 'Incomplete' }); // missing unit_price and stock

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/validation failed/i);
  });

  it('returns 422 when unit_price is negative', async () => {
    const res = await request(app)
      .post('/api/products')
      .set(auth('Manager'))
      .send({ name: 'Bad Price', unit_price: -5, stock: 10 });

    expect(res.status).toBe(422);
  });

  it('creates product successfully for Manager', async () => {
    // No reference sent — createProduct skips the duplicate check query
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 10, name: 'New Laptop', unit_price: '999.00', stock: 5 }] });

    const res = await request(app)
      .post('/api/products')
      .set(auth('Manager'))
      .send({ name: 'New Laptop', unit_price: 999, stock: 5 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'New Laptop', id: 10 });
  });

  it('creates product successfully for Administrator', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 11, name: 'Admin Product', unit_price: '500.00', stock: 20 }] });

    const res = await request(app)
      .post('/api/products')
      .set(auth('Administrator'))
      .send({ name: 'Admin Product', unit_price: 500, stock: 20 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Admin Product' });
  });

  it('returns 409 when reference already exists', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 5 }] }); // duplicate found

    const res = await request(app)
      .post('/api/products')
      .set(auth('Manager'))
      .send({ name: 'Duplicate', unit_price: 100, stock: 5, reference: 'REF-001' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/i);
  });

});

// ── DELETE /api/products/:id ──────────────────────────────────────────────────
describe('DELETE /api/products/:id', () => {

  it('returns 403 when Manager tries to delete', async () => {
    const res = await request(app)
      .delete('/api/products/1')
      .set(auth('Manager'));

    expect(res.status).toBe(403);
  });

  it('returns 403 when Sales Agent tries to delete', async () => {
    const res = await request(app)
      .delete('/api/products/1')
      .set(auth('Sales Agent'));

    expect(res.status).toBe(403);
  });

  it('returns 404 when product does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/products/9999')
      .set(auth('Administrator'));

    expect(res.status).toBe(404);
  });

  it('deletes product successfully for Administrator', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Old Product' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/products/1')
      .set(auth('Administrator'));

    expect(res.status).toBe(200);
  });

});

// ── GET /api/products/:id ─────────────────────────────────────────────────────
describe('GET /api/products/:id', () => {

  it('returns 404 when product does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/products/9999')
      .set(auth('Manager'));

    expect(res.status).toBe(404);
  });

  it('returns product data when found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [
      { id: 1, name: 'Dell Monitor', stock: 8, unit_price: '320.00' }
    ]});

    const res = await request(app)
      .get('/api/products/1')
      .set(auth('Manager'));

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Dell Monitor');
    expect(res.body.stock).toBe(8);
  });

});
