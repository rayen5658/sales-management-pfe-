const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');

const controller = require('./controllers/index');
const { verifyToken, authorizeRoles } = require('./middleware');
const { authRouter: clientAuthRoutes, portalRouter: clientPortalRoutes } = require('./routes/clientPortal');
const {
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
  validateForgotPassword,
  validateResetPassword,
  validateUpdateUser,
  validatePaginationQuery,
  validateUpdatePaymentSettings,
  validateMarkOrderPaid,
  validateCreateSupplier,
  validateUpdateSupplier,
  validateCreatePurchaseOrder,
  validateUpdatePurchaseOrderStatus,
  validateCreateVariant,
  validateUpdateVariant,
} = require('./validators');

// Multer — store CSV in OS temp dir, accept only csv/text
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || file.mimetype === 'text/csv' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

// AUTH - public
router.post('/auth/login', validateLoginUser, controller.loginUser);
// /auth/register is intentionally removed from public routes.
// New users must be created by an Administrator via the Users page (POST /users/register).
router.post('/auth/register', verifyToken, authorizeRoles('Administrator'), validateRegisterUser, controller.registerUser);
router.post('/auth/forgot-password', validateForgotPassword, controller.forgotPassword);
router.post('/auth/reset-password', validateResetPassword, controller.resetPassword);

// PRODUCTS
router.get('/products', verifyToken, validatePaginationQuery, controller.getAllProducts);
router.post('/products', verifyToken, authorizeRoles('Administrator', 'Manager'), validateCreateProduct, controller.createProduct);
router.post('/products/import-csv', verifyToken, authorizeRoles('Administrator', 'Manager'), upload.single('file'), controller.importProductsCSV);
router.get('/products/:id', verifyToken, controller.getProductById);
router.put('/products/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), validateUpdateProduct, controller.updateProduct);
router.delete('/products/:id', verifyToken, authorizeRoles('Administrator'), controller.deleteProduct);
router.get('/products/:productId/variants', verifyToken, controller.getVariantsByProduct);
router.post('/products/:productId/variants', verifyToken, authorizeRoles('Administrator', 'Manager'), validateCreateVariant, controller.createVariant);
router.put('/variants/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), validateUpdateVariant, controller.updateVariant);
router.delete('/variants/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.deleteVariant);

// CATEGORIES
router.get('/categories', verifyToken, controller.getAllCategories);
router.get('/categories/:id', verifyToken, controller.getCategoryById);
router.post('/categories', verifyToken, authorizeRoles('Administrator', 'Manager'), validateCreateCategory, controller.createCategory);
router.put('/categories/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), validateUpdateCategory, controller.updateCategory);
router.delete('/categories/:id', verifyToken, authorizeRoles('Administrator'), controller.deleteCategory);

// CLIENTS
router.get('/clients', verifyToken, controller.getAllClients);
router.get('/clients/:id', verifyToken, controller.getClientById);
router.get('/clients/:id/orders', verifyToken, controller.getClientOrders);
router.post('/clients', verifyToken, authorizeRoles('Administrator', 'Manager', 'Sales Agent'), validateCreateClient, controller.createClient);
router.put('/clients/:id/archive', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.archiveClient);
router.put('/clients/:id/restore', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.restoreClient);
router.put('/clients/:id/approve', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.approveClient);
router.put('/clients/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), validateUpdateClient, controller.updateClient);
router.delete('/clients/:id', verifyToken, authorizeRoles('Administrator'), controller.deleteClient);

// ORDERS
router.get('/orders', verifyToken, validatePaginationQuery, controller.getAllOrders);
router.get('/orders/pending/admin', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.getPendingClientOrders);
router.get('/orders/:id', verifyToken, controller.getOrderById);
router.get('/orders/:id/tracking', verifyToken, controller.getOrderTracking);
router.post('/orders', verifyToken, authorizeRoles('Administrator', 'Manager', 'Sales Agent'), validateCreateOrder, controller.createOrder);
router.post('/orders/client/create', verifyToken, controller.clientCreateOrder);
router.put('/orders/:id', verifyToken, authorizeRoles('Administrator', 'Manager', 'Sales Agent'), validateUpdateOrder, controller.updateOrder);
router.put('/orders/:id/cancel', verifyToken, authorizeRoles('Administrator', 'Manager', 'Sales Agent'), validateCancelOrder, controller.cancelOrder);
router.put('/orders/:id/status', verifyToken, authorizeRoles('Administrator', 'Manager'), validateUpdateOrderStatus, controller.updateOrderStatus);
router.post('/orders/:id/ship', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.shipOrder);
router.put('/orders/:id/mark-paid', verifyToken, authorizeRoles('Administrator', 'Manager'), validateMarkOrderPaid, controller.markOrderPaid);

// RETURNS (admin only)
router.get('/returns', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.getAllReturns);
router.put('/returns/:id/approve', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.approveReturn);
router.put('/returns/:id/reject', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.rejectReturn);

// FEEDBACK (admin only, read)
router.get('/feedback', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.getAllFeedback);

// SUPPLIERS (Administrator/Manager — purchasing is a management decision, not Sales Agent territory)
router.get('/suppliers', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.getAllSuppliers);
router.get('/suppliers/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.getSupplierById);
router.post('/suppliers', verifyToken, authorizeRoles('Administrator', 'Manager'), validateCreateSupplier, controller.createSupplier);
router.put('/suppliers/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), validateUpdateSupplier, controller.updateSupplier);
router.delete('/suppliers/:id', verifyToken, authorizeRoles('Administrator'), controller.deleteSupplier);

// PURCHASE ORDERS (Administrator/Manager)
router.get('/purchase-orders', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.getAllPurchaseOrders);
router.get('/purchase-orders/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.getPurchaseOrderById);
router.post('/purchase-orders', verifyToken, authorizeRoles('Administrator', 'Manager'), validateCreatePurchaseOrder, controller.createPurchaseOrder);
router.put('/purchase-orders/:id/status', verifyToken, authorizeRoles('Administrator', 'Manager'), validateUpdatePurchaseOrderStatus, controller.updatePurchaseOrderStatus);
router.put('/purchase-orders/:id/cancel', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.cancelPurchaseOrder);
router.delete('/purchase-orders/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.deletePurchaseOrder);


// USERS (admin only)
router.get('/users', verifyToken, authorizeRoles('Administrator'), controller.getAllUsers);
router.put('/users/:id', verifyToken, authorizeRoles('Administrator'), validateUpdateUser, controller.updateUser);
router.put('/users/:id/status', verifyToken, authorizeRoles('Administrator'), controller.toggleUserStatus);
router.put('/users/:id/reset-password', verifyToken, authorizeRoles('Administrator'), controller.resetUserPassword);
router.delete('/users/:id', verifyToken, authorizeRoles('Administrator'), controller.deleteUser);

// ROLES
router.get('/roles', verifyToken, controller.getAllRoles);

// DASHBOARD
router.get('/dashboard/stats', verifyToken, controller.getDashboardStats);
router.get('/dashboard/region', verifyToken, controller.getSalesByRegion);
router.put('/dashboard/goal', verifyToken, authorizeRoles('Administrator'), controller.setMonthlyGoal);

// NOTIFICATIONS (Administrator/Manager) — polled by the TopBar bell
router.get('/notifications', verifyToken, authorizeRoles('Administrator', 'Manager'), controller.getNotifications);

// AUDIT LOGS (admin only)
router.get('/audit-logs', verifyToken, authorizeRoles('Administrator'), controller.getAuditLogs);

// PAYMENT SETTINGS (admin only) — lets the business owner plug in their own Konnect account
router.get('/payment-settings', verifyToken, authorizeRoles('Administrator'), controller.getPaymentSettings);
router.put('/payment-settings', verifyToken, authorizeRoles('Administrator'), validateUpdatePaymentSettings, controller.updatePaymentSettings);

// CHATBOT
// Two implementations available — only one should be active at a time.
// Option A: Rule-based FAQ bot (no API key needed, always safe to enable)
const chatbotRoutes = require('./routes/chatbot');
router.use('/chatbot', chatbotRoutes);

// Option B: Gemini AI bot (requires GEMINI_API_KEY in .env)
// Uncomment the two lines below AND comment out Option A to switch.
// const chatbotGeminiRoutes = require('./routes/chatbotGemini');
// router.use('/chatbot', chatbotGeminiRoutes);


// INTERNAL DELIVERY SIMULATION API
const deliverySimulationRoutes = require('./routes/deliverySimulation');
router.use('/delivery-simulation', deliverySimulationRoutes);

// CLIENT PORTAL
router.use('/client-auth', clientAuthRoutes);
router.use('/client-portal', clientPortalRoutes);

// CLIENT CHATBOT (uses client JWT, no AI credits required)
const clientChatbotRoutes = require('./routes/clientChatbot');
router.use('/client-chatbot', clientChatbotRoutes);

module.exports = router;

