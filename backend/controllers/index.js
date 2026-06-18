// Re-exports the main controllers monolith.
// Split domain files (products.js, etc.) can override specific exports here
// as the refactor progresses, without touching routes.js.
module.exports = require('../controllers');
