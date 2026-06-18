const express = require('express');

const router = express.Router();

// Simulated internal delivery provider.
// This mimics a real courier API response with random data.
// Returns:
// - tracking_number (e.g. DYN-XXXXXX)
// - estimated_delivery (3–5 days from now)
// - delivery_status: "In Transit"

function generateTrackingNumber() {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `DYN-${rand}`;
}

function generateEstimatedDeliveryDate() {
  const days = Math.floor(3 + Math.random() * 3); // 3..5
  const d = new Date();
  d.setDate(d.getDate() + days);
  // YYYY-MM-DD
  return d.toISOString().split('T')[0];
}

router.post('/simulate', (req, res) => {
  const { orderId } = req.body || {};

  const tracking_number = generateTrackingNumber();
  const estimated_delivery = generateEstimatedDeliveryDate();

  res.json({
    success: true,
    provider: 'Dynamic Delivery',
    tracking_number,
    estimated_delivery,
    delivery_status: 'In Transit',
    shipment_id: orderId ? `SHP-${orderId}-${Date.now()}` : `SHP-${Date.now()}`,
  });
});

module.exports = router;

