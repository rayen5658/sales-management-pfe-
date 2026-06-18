/**
 * Shared business constants for the backend.
 */

// TVA (Value Added Tax) rate applied to all orders in Tunisia.
// Override via TVA_RATE environment variable if the rate changes.
const TVA_RATE = parseFloat(process.env.TVA_RATE) || 0.19;

module.exports = { TVA_RATE };
