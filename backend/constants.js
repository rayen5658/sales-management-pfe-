/**
 * Shared business constants for the backend.
 */

// TVA (Value Added Tax) rate applied to all orders in Tunisia.
const TVA_RATE = parseFloat(process.env.TVA_RATE) || 0.19;

// Number of units at or below which a product is considered low-stock.
const LOW_STOCK_THRESHOLD = parseInt(process.env.LOW_STOCK_THRESHOLD) || 5;

// Days until an order is due, per client payment_terms.
const PAYMENT_TERMS_DAYS = { immediate: 0, net_15: 15, net_30: 30, net_60: 60 };

// Maximum allowed order-level discount percentage.
const MAX_DISCOUNT_PERCENT = 100;

module.exports = { TVA_RATE, LOW_STOCK_THRESHOLD, PAYMENT_TERMS_DAYS, MAX_DISCOUNT_PERCENT };
