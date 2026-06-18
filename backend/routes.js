const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const os = require('os');

const controller = require('./controllers');
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
  validateUpdateUser,
  validatePaginationQuery,
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
      cb(new Error('Seuls les fichiers CSV sont acceptés'));
    }
  },
});

// AUTH - public
router.post('/auth/login', validateLoginUser, controller.loginUser);
// /auth/register is intentionally removed from public routes.
// New users must be created by an Administrator via the Users page (POST /users/register).
router.post('/auth/register', verifyToken, authorizeRoles('Administrator'), validateRegisterUser, controller.registerUser);

// PRODUCTS
router.get('/products', verifyToken, validatePaginationQuery, controller.getAllProducts);
router.post('/products', verifyToken, authorizeRoles('Administrator', 'Manager'), validateCreateProduct, controller.createProduct);
router.post('/products/import-csv', verifyToken, authorizeRoles('Administrator', 'Manager'), upload.single('file'), controller.importProductsCSV);
router.get('/products/:id', verifyToken, controller.getProductById);
router.put('/products/:id', verifyToken, authorizeRoles('Administrator', 'Manager'), validateUpdateProduct, controller.updateProduct);
router.delete('/products/:id', verifyToken, authorizeRoles('Administrator'), controller.deleteProduct);

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

// AUDIT LOGS (admin only)
router.get('/audit-logs', verifyToken, authorizeRoles('Administrator'), controller.getAuditLogs);

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

