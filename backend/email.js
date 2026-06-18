// ═══════════════════════════════════════════════════════════
// EMAIL SERVICE — Nodemailer
// Sends order status notifications to clients
// ═══════════════════════════════════════════════════════════
const nodemailer = require('nodemailer');

// ── Transporter (configured from .env) ──────────────────────
// Supports Gmail, Outlook, or any SMTP provider
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Status config ────────────────────────────────────────────
const STATUS_CONFIG = {
  confirmed: {
    emoji: '✅',
    label: 'Confirmed',
    color: '#4f46e5',
    bg: '#eff6ff',
    border: '#bfdbfe',
    message: 'Great news! Your order has been confirmed and is being prepared.',
  },
  shipped: {
    emoji: '🚚',
    label: 'Shipped',
    color: '#16a34a',
    bg: '#f0fdf4',
    border: '#bbf7d0',
    message: 'Your order is on its way! It has been handed to our delivery partner.',
  },
  delivered: {
    emoji: '📦',
    label: 'Delivered',
    color: '#7c3aed',
    bg: '#faf5ff',
    border: '#e9d5ff',
    message: 'Your order has been delivered. We hope you enjoy your products!',
  },
  cancelled: {
    emoji: '❌',
    label: 'Cancelled',
    color: '#dc2626',
    bg: '#fef2f2',
    border: '#fecaca',
    message: 'Your order has been cancelled. Please contact us if you have any questions.',
  },
  pending: {
    emoji: '⏳',
    label: 'Pending',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fcd34d',
    message: 'Your order has been received and is awaiting confirmation from our team.',
  },
};

// ── HTML email template ───────────────────────────────────────
function buildOrderStatusEmail({ order, status, clientName, lines, trackingNumber, estimatedDelivery, cancelReason }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const fmtTND = v => new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 2 }).format(parseFloat(v || 0)) + ' TND';

  const linesHTML = lines && lines.length > 0 ? `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Product</th>
          <th style="padding:8px 12px;text-align:center;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Qty</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${lines.map((l, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
            <td style="padding:8px 12px;font-size:13px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;">${l.product_name || l.name || '—'}</td>
            <td style="padding:8px 12px;text-align:center;font-size:13px;color:#64748b;border-bottom:1px solid #f1f5f9;">${l.quantity}</td>
            <td style="padding:8px 12px;text-align:right;font-size:13px;color:#4f46e5;font-weight:700;border-bottom:1px solid #f1f5f9;">${fmtTND(parseFloat(l.unit_price) * parseInt(l.quantity))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  const trackingHTML = trackingNumber ? `
    <div style="margin-top:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;">
      <p style="margin:0;font-size:12px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Tracking Number</p>
      <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#15803d;letter-spacing:0.08em;">${trackingNumber}</p>
      ${estimatedDelivery ? `<p style="margin:6px 0 0;font-size:12px;color:#166534;">Estimated delivery: <strong>${new Date(estimatedDelivery).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong></p>` : ''}
    </div>
  ` : '';

  const cancelHTML = cancelReason ? `
    <div style="margin-top:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;">
      <p style="margin:0;font-size:12px;color:#991b1b;font-weight:600;">Cancellation reason:</p>
      <p style="margin:4px 0 0;font-size:13px;color:#b91c1c;">${cancelReason}</p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">${cfg.emoji}</div>
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.02em;">Order ${cfg.label}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Order #${order.id}</p>
          </td>
        </tr>

        <!-- Status banner -->
        <tr>
          <td style="background:${cfg.bg};border-bottom:2px solid ${cfg.border};padding:16px 32px;">
            <p style="margin:0;color:${cfg.color};font-size:14px;font-weight:600;text-align:center;">${cfg.message}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hello <strong>${clientName}</strong>,</p>

            <!-- Order summary -->
            <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-bottom:20px;border:1px solid #e2e8f0;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Order Details</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  ['Order #', `#${order.id}`],
                  ['Date', new Date(order.order_date).toLocaleDateString('en-GB')],
                  ['Status', `<span style="background:${cfg.bg};color:${cfg.color};padding:2px 10px;border-radius:999px;font-weight:700;font-size:12px;">${cfg.label}</span>`],
                  ['Subtotal (ex. tax)', fmtTND(order.amount_ht)],
                  ['Tax (19%)', fmtTND(order.tva)],
                  ['<strong>Total (inc. tax)</strong>', `<strong style="color:#4f46e5;font-size:16px;">${fmtTND(order.amount_ttc)}</strong>`],
                ].map(([label, value]) => `
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#64748b;">${label}</td>
                    <td style="padding:5px 0;font-size:13px;text-align:right;">${value}</td>
                  </tr>
                `).join('')}
              </table>
            </div>

            ${linesHTML ? `
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Products</p>
              <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
                ${linesHTML}
              </div>
            ` : ''}

            ${trackingHTML}
            ${cancelHTML}

            <!-- CTA -->
            <div style="text-align:center;margin-top:28px;">
              <p style="font-size:13px;color:#94a3b8;margin:0;">Need help? Contact our support team.</p>
              <p style="font-size:13px;color:#94a3b8;margin:4px 0 0;">📧 ${process.env.SMTP_USER || 'support@salesmanager.tn'}</p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} Sales Manager · Tunisia</p>
            <p style="margin:4px 0 0;font-size:11px;color:#cbd5e1;">This is an automated notification — please do not reply.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

// ── Order placed confirmation (client portal) ──────────────
function buildOrderPlacedEmail({ order, clientName, lines }) {
  return buildOrderStatusEmail({ order, status: 'pending', clientName, lines });
}

// ── Main send function ────────────────────────────────────────
async function sendOrderStatusEmail({ toEmail, toName, order, status, lines, trackingNumber, estimatedDelivery, cancelReason }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠ Email not configured — set SMTP_USER and SMTP_PASS in .env to enable notifications');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const html = buildOrderStatusEmail({ order, status, clientName: toName, lines, trackingNumber, estimatedDelivery, cancelReason });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: `"${toName}" <${toEmail}>`,
      subject: `${cfg.emoji} Order #${order.id} — ${cfg.label}`,
      html,
    });
    console.log(`✅ Email sent to ${toEmail} — Order #${order.id} ${cfg.label} (${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email failed for Order #${order.id}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendOrderStatusEmail, buildOrderPlacedEmail };
