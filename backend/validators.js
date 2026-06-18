/**
 * Request body validators using express-validator.
 * Each export is an array of middleware to be spread into a route definition.
 *
 * Usage in routes.js:
 *   const { validateCreateProduct, ... } = require('./validators');
 *   router.post('/products', verifyToken, ...validateCreateProduct, controller.createProduct);
 */

const { body, query } = require('express-validator');

// ── Products ──────────────────────────────────────────────────────────────────

const validateCreateProduct = [
  body('name')
    .trim()
    .notEmpty().withMessage('name is required')
    .isLength({ max: 200 }).withMessage('name must be at most 200 characters'),
  body('reference')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('reference must be at most 100 characters'),
  body('unit_price')
    .notEmpty().withMessage('unit_price is required')
    .isFloat({ min: 0 }).withMessage('unit_price must be a non-negative number'),
  body('stock')
    .notEmpty().withMessage('stock is required')
    .isInt({ min: 0 }).withMessage('stock must be a non-negative integer'),
  body('category_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('category_id must be a positive integer'),
];

const validateUpdateProduct = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('name cannot be empty')
    .isLength({ max: 200 }).withMessage('name must be at most 200 characters'),
  body('unit_price')
    .optional()
    .isFloat({ min: 0 }).withMessage('unit_price must be a non-negative number'),
  body('stock')
    .optional()
    .isInt({ min: 0 }).withMessage('stock must be a non-negative integer'),
  body('category_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('category_id must be a positive integer'),
];

// ── Categories ────────────────────────────────────────────────────────────────

const validateCreateCategory = [
  body('name')
    .trim()
    .notEmpty().withMessage('name is required')
    .isLength({ max: 100 }).withMessage('name must be at most 100 characters'),
  body('parent_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('parent_id must be a positive integer'),
];

const validateUpdateCategory = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('name cannot be empty')
    .isLength({ max: 100 }).withMessage('name must be at most 100 characters'),
  body('parent_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('parent_id must be a positive integer'),
];

// ── Clients ───────────────────────────────────────────────────────────────────

const validateCreateClient = [
  body('company_name')
    .trim()
    .notEmpty().withMessage('company_name is required')
    .isLength({ max: 200 }).withMessage('company_name must be at most 200 characters'),
  body('email')
    .optional({ nullable: true })
    .trim()
    .isEmail().withMessage('email must be a valid email address')
    .normalizeEmail(),
  body('phone')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 30 }).withMessage('phone must be at most 30 characters'),
  body('segment')
    .optional({ nullable: true })
    .trim()
    .isIn(['SMB', 'Enterprise', 'Public', 'Startup', '']).withMessage('segment must be one of: SMB, Enterprise, Public, Startup'),
];

const validateUpdateClient = validateCreateClient; // same rules apply

// ── Orders ────────────────────────────────────────────────────────────────────

const validateCreateOrder = [
  body('client_id')
    .notEmpty().withMessage('client_id is required')
    .isInt({ min: 1 }).withMessage('client_id must be a positive integer'),
  body('user_id')
    .notEmpty().withMessage('user_id is required')
    .isInt({ min: 1 }).withMessage('user_id must be a positive integer'),
  body('items')
    .isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.product_id')
    .isInt({ min: 1 }).withMessage('each item.product_id must be a positive integer'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('each item.quantity must be a positive integer'),
];

const validateUpdateOrder = [
  body('items')
    .isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.product_id')
    .isInt({ min: 1 }).withMessage('each item.product_id must be a positive integer'),
  body('items.*.quantity')
    .isInt({ min: 1 }).withMessage('each item.quantity must be a positive integer'),
  body('client_id')
    .optional()
    .isInt({ min: 1 }).withMessage('client_id must be a positive integer'),
];

const validateUpdateOrderStatus = [
  body('status')
    .notEmpty().withMessage('status is required')
    .isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'])
    .withMessage('status must be one of: pending, confirmed, shipped, delivered, cancelled'),
];

const validateCancelOrder = [
  body('cancel_reason')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('cancel_reason must be at most 500 characters'),
];

// ── Users ─────────────────────────────────────────────────────────────────────

const validateRegisterUser = [
  body('firstname')
    .trim()
    .notEmpty().withMessage('firstname is required')
    .isLength({ max: 100 }).withMessage('firstname must be at most 100 characters'),
  body('lastname')
    .trim()
    .notEmpty().withMessage('lastname is required')
    .isLength({ max: 100 }).withMessage('lastname must be at most 100 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('email is required')
    .isEmail().withMessage('email must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('password is required')
    .isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
  body('role_id')
    .notEmpty().withMessage('role_id is required')
    .isInt({ min: 1 }).withMessage('role_id must be a positive integer'),
];

const validateLoginUser = [
  body('email')
    .trim()
    .notEmpty().withMessage('email is required')
    .isEmail().withMessage('email must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('password is required'),
];

const validateUpdateUser = [
  body('firstname')
    .optional()
    .trim()
    .notEmpty().withMessage('firstname cannot be empty')
    .isLength({ max: 100 }).withMessage('firstname must be at most 100 characters'),
  body('lastname')
    .optional()
    .trim()
    .notEmpty().withMessage('lastname cannot be empty')
    .isLength({ max: 100 }).withMessage('lastname must be at most 100 characters'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('email must be a valid email address')
    .normalizeEmail(),
  body('role_id')
    .optional()
    .isInt({ min: 1 }).withMessage('role_id must be a positive integer'),
  body('status')
    .optional()
    .isIn(['active', 'inactive']).withMessage('status must be active or inactive'),
];

// ── Pagination ────────────────────────────────────────────────────────────────

const validatePaginationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 }).withMessage('limit must be between 1 and 200'),
];

module.exports = {
  validateCreateProduct,
  validateUpdateProduct,
  validateCreateCategory,
  validateUpdateCategory,
  validateCreateClient,
  validateUpdateClient,
  validateCreateOrder,
  validateUpdateOrder,
  validateUpdateOrderStatus,
  validateCancelOrder,
  validateRegisterUser,
  validateLoginUser,
  validateUpdateUser,
  validatePaginationQuery,
};
