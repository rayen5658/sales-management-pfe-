// ── Modular controllers index ─────────────────────────────────────────────────
// Domain exports: auth, products, orders, clients, categories, users, dashboard, audit
//
// Keep route behavior identical: export the same handler function names.

const products = require('./products');
const auth = require('./auth');
const orders = require('./orders');
const clients = require('./clients');
const categories = require('./categories');
const users = require('./users');
const dashboard = require('./dashboard');
const audit = require('./audit');
const paymentSettings = require('./paymentSettings');
const returns = require('./returns');
const feedback = require('./feedback');
const suppliers = require('./suppliers');
const purchaseOrders = require('./purchaseOrders');
const productVariants = require('./productVariants');

module.exports = {
  // Shared helpers (rarely used directly by routes, but keep for compatibility)
  // eslint-disable-next-line no-unused-vars

  // Auth
  registerUser: auth.registerUser,
  loginUser: auth.loginUser,
  forgotPassword: auth.forgotPassword,
  resetPassword: auth.resetPassword,

  // Products
  getAllProducts: products.getAllProducts,
  getProductById: products.getProductById,
  createProduct: products.createProduct,
  updateProduct: products.updateProduct,
  deleteProduct: products.deleteProduct,
  importProductsCSV: products.importProductsCSV,

  // Orders
  getAllOrders: orders.getAllOrders,
  getOrderById: orders.getOrderById,
  createOrder: orders.createOrder,
  cancelOrder: orders.cancelOrder,
  updateOrder: orders.updateOrder,
  updateOrderStatus: orders.updateOrderStatus,
  shipOrder: orders.shipOrder,
  clientCreateOrder: orders.clientCreateOrder,
  getOrderTracking: orders.getOrderTracking,
  getOrderStatusHistory: orders.getOrderStatusHistory,
  getPendingClientOrders: orders.getPendingClientOrders,
  markOrderPaid: orders.markOrderPaid,

  // Clients
  getAllClients: clients.getAllClients,
  getClientById: clients.getClientById,
  getClientOrders: clients.getClientOrders,
  createClient: clients.createClient,
  updateClient: clients.updateClient,
  deleteClient: clients.deleteClient,
  archiveClient: clients.archiveClient,
  restoreClient: clients.restoreClient,
  approveClient: clients.approveClient,

  // Categories
  getAllCategories: categories.getAllCategories,
  getCategoryById: categories.getCategoryById,
  createCategory: categories.createCategory,
  updateCategory: categories.updateCategory,
  deleteCategory: categories.deleteCategory,

  // Users & Roles
  getAllUsers: users.getAllUsers,
  updateUser: users.updateUser,
  toggleUserStatus: users.toggleUserStatus,
  resetUserPassword: users.resetUserPassword,
  deleteUser: users.deleteUser,
  getAllRoles: users.getAllRoles,

  // Dashboard
  getDashboardStats: dashboard.getDashboardStats,
  getSalesByRegion: dashboard.getSalesByRegion,
  setMonthlyGoal: dashboard.setMonthlyGoal,
  getNotifications: dashboard.getNotifications,

  // Audit
  getAuditLogs: audit.getAuditLogs,

  // Payment settings
  getPaymentSettings: paymentSettings.getPaymentSettings,
  updatePaymentSettings: paymentSettings.updatePaymentSettings,

  // Returns
  getAllReturns: returns.getAllReturns,
  approveReturn: returns.approveReturn,
  rejectReturn: returns.rejectReturn,

  // Feedback
  getAllFeedback: feedback.getAllFeedback,

  // Suppliers
  getAllSuppliers: suppliers.getAllSuppliers,
  getSupplierById: suppliers.getSupplierById,
  createSupplier: suppliers.createSupplier,
  updateSupplier: suppliers.updateSupplier,
  deleteSupplier: suppliers.deleteSupplier,

  // Purchase orders
  getAllPurchaseOrders: purchaseOrders.getAllPurchaseOrders,
  getPurchaseOrderById: purchaseOrders.getPurchaseOrderById,
  createPurchaseOrder: purchaseOrders.createPurchaseOrder,
  updatePurchaseOrderStatus: purchaseOrders.updatePurchaseOrderStatus,
  cancelPurchaseOrder: purchaseOrders.cancelPurchaseOrder,
  deletePurchaseOrder: purchaseOrders.deletePurchaseOrder,

  // Product variants
  getVariantsByProduct: productVariants.getVariantsByProduct,
  createVariant: productVariants.createVariant,
  updateVariant: productVariants.updateVariant,
  deleteVariant: productVariants.deleteVariant,
};

