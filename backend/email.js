// ═══════════════════════════════════════════════════════════
// EMAIL SERVICE — Nodemailer
// Sends order status notifications to clients
// ═══════════════════════════════════════════════════════════
const nodemailer = require('nodemailer');

// Escapes user-supplied strings (client company names, return reasons, notes)
// before they're interpolated into HTML email bodies.
const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

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
            <td style="padding:8px 12px;font-size:13px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;">${escapeHtml(l.product_name || l.name || '—')}</td>
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
      <p style="margin:4px 0 0;font-size:13px;color:#b91c1c;">${escapeHtml(cancelReason)}</p>
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
            <p style="margin:0 0 20px;font-size:15px;color:#374151;">Hello <strong>${escapeHtml(clientName)}</strong>,</p>

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

// ── Generic branded notice template (reset link, registration, approval) ──
function buildNoticeEmail({ heading, greetingName, bodyHtml, ctaLabel, ctaUrl }) {
  const ctaHTML = ctaUrl ? `
    <div style="text-align:center;margin-top:24px;">
      <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;">${ctaLabel}</a>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.02em;">${heading}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#374151;">Hello${greetingName ? ` <strong>${escapeHtml(greetingName)}</strong>` : ''},</p>
            <div style="font-size:14px;color:#374151;line-height:1.6;">${bodyHtml}</div>
            ${ctaHTML}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">© ${new Date().getFullYear()} Sales Manager · Tunisia</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

// ── Password reset (admin/staff) ────────────────────────────
async function sendPasswordResetEmail({ toEmail, toName, resetUrl }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('⚠ Email not configured — set SMTP_USER and SMTP_PASS in .env to enable password reset emails');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const html = buildNoticeEmail({
    heading: '🔒 Password Reset Request',
    greetingName: toName,
    bodyHtml: `
      <p style="margin:0 0 12px;">We received a request to reset your password. Click the button below to choose a new one.</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;">This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.</p>
    `,
    ctaLabel: 'Reset my password',
    ctaUrl: resetUrl,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: { name: toName, address: toEmail },
      subject: '🔒 Reset your Sales Manager password',
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Password reset email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Client self-registration confirmation ───────────────────
async function sendClientRegistrationEmail({ toEmail, toName }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { sent: false, reason: 'SMTP not configured' };

  const html = buildNoticeEmail({
    heading: '👋 Registration received',
    greetingName: toName,
    bodyHtml: `<p style="margin:0;">Thanks for registering for the Client Portal. Your account is <strong>pending approval</strong> — we'll email you as soon as our team reviews and activates it.</p>`,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: { name: toName, address: toEmail },
      subject: '👋 We received your registration',
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Registration email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Client account approved ──────────────────────────────────
async function sendClientApprovedEmail({ toEmail, toName, loginUrl }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { sent: false, reason: 'SMTP not configured' };

  const html = buildNoticeEmail({
    heading: '✅ Account approved',
    greetingName: toName,
    bodyHtml: `<p style="margin:0;">Your Client Portal account has been approved. You can now sign in to browse products and place orders.</p>`,
    ctaLabel: 'Sign in',
    ctaUrl: loginUrl,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: { name: toName, address: toEmail },
      subject: '✅ Your Client Portal account is approved',
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Approval email failed:', err.message);
    return { sent: false, reason: err.message };
  }
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
      to: { name: toName, address: toEmail },
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

// ── Payment received ─────────────────────────────────────────
async function sendPaymentReceivedEmail({ toEmail, toName, order }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { sent: false, reason: 'SMTP not configured' };
  const fmtTND = v => new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 2 }).format(parseFloat(v || 0)) + ' TND';
  const clientOrdersUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/client/orders`;

  const html = buildNoticeEmail({
    heading: '💰 Payment received',
    greetingName: toName,
    bodyHtml: `
      <p style="margin:0 0 12px;">We've received your payment of <strong>${fmtTND(order.amount_ttc)}</strong> for order <strong>#${order.id}</strong>. Thank you!</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;">Your order will now move forward for preparation and shipping.</p>
    `,
    ctaLabel: 'View my orders',
    ctaUrl: clientOrdersUrl,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: { name: toName, address: toEmail },
      subject: `💰 Payment received — Order #${order.id}`,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Payment received email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Payment failed ───────────────────────────────────────────
async function sendPaymentFailedEmail({ toEmail, toName, order }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { sent: false, reason: 'SMTP not configured' };
  const clientOrdersUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/client/orders`;

  const html = buildNoticeEmail({
    heading: '⚠ Payment failed',
    greetingName: toName,
    bodyHtml: `
      <p style="margin:0 0 12px;">Your payment for order <strong>#${order.id}</strong> didn't go through. No charge was made.</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;">You can try again from your orders page, or choose a different payment method.</p>
    `,
    ctaLabel: 'Try again',
    ctaUrl: clientOrdersUrl,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: { name: toName, address: toEmail },
      subject: `⚠ Payment failed — Order #${order.id}`,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Payment failed email failed to send:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Bank transfer declared, awaiting confirmation ────────────
async function sendBankTransferPendingEmail({ toEmail, toName, order }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { sent: false, reason: 'SMTP not configured' };
  const fmtTND = v => new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 2 }).format(parseFloat(v || 0)) + ' TND';

  const html = buildNoticeEmail({
    heading: '🏦 Bank transfer noted',
    greetingName: toName,
    bodyHtml: `
      <p style="margin:0 0 12px;">We've noted that you're paying <strong>${fmtTND(order.amount_ttc)}</strong> for order <strong>#${order.id}</strong> by bank transfer.</p>
      <p style="margin:0;color:#94a3b8;font-size:12px;">Your order will be marked as paid once we confirm the funds have arrived in our account. This can take 1–2 business days.</p>
    `,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: { name: toName, address: toEmail },
      subject: `🏦 Bank transfer noted — Order #${order.id}`,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Bank transfer notice email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── New order alert to staff ─────────────────────────────────
// NOTIFY_EMAIL lets the business owner point alerts at a different inbox than
// the sending account; falls back to SMTP_USER (the same account emails are sent from).
async function sendNewOrderAlertToStaff({ order, clientName, lines }) {
  const notifyTo = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !notifyTo) return { sent: false, reason: 'SMTP not configured' };
  const fmtTND = v => new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 2 }).format(parseFloat(v || 0)) + ' TND';
  const ordersUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders`;

  const itemsHtml = (lines || []).map(l => `<li style="margin-bottom:4px;">${l.quantity} × ${escapeHtml(l.product_name || l.name || '—')}</li>`).join('');

  const html = buildNoticeEmail({
    heading: '🔔 New order received',
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>${escapeHtml(clientName)}</strong> just placed order <strong>#${order.id}</strong> for <strong>${fmtTND(order.amount_ttc)}</strong>.</p>
      ${itemsHtml ? `<ul style="margin:0 0 12px;padding-left:18px;font-size:13px;color:#374151;">${itemsHtml}</ul>` : ''}
      <p style="margin:0;color:#94a3b8;font-size:12px;">It's awaiting your confirmation.</p>
    `,
    ctaLabel: 'Review order',
    ctaUrl: ordersUrl,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: notifyTo,
      subject: `🔔 New order #${order.id} — ${clientName}`,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ New order alert email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Return request received (client confirmation) ───────────
async function sendReturnRequestedEmail({ toEmail, toName, order }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { sent: false, reason: 'SMTP not configured' };
  const html = buildNoticeEmail({
    heading: '↩️ Return request received',
    greetingName: toName,
    bodyHtml: `<p style="margin:0;">We've received your return request for order <strong>#${order.id}</strong>. Our team will review it and get back to you shortly.</p>`,
  });
  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`, to: { name: toName, address: toEmail },
      subject: `↩️ Return request received — Order #${order.id}`, html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Return requested email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Return approved / rejected (client) ──────────────────────
async function sendReturnResolvedEmail({ toEmail, toName, order, approved, resolutionNote }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { sent: false, reason: 'SMTP not configured' };
  const html = buildNoticeEmail({
    heading: approved ? '✅ Return approved' : '❌ Return rejected',
    greetingName: toName,
    bodyHtml: `
      <p style="margin:0 0 12px;">Your return request for order <strong>#${order.id}</strong> has been <strong>${approved ? 'approved' : 'rejected'}</strong>.</p>
      ${resolutionNote ? `<p style="margin:0;color:#64748b;font-size:13px;">"${escapeHtml(resolutionNote)}"</p>` : ''}
    `,
  });
  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`, to: { name: toName, address: toEmail },
      subject: `${approved ? '✅' : '❌'} Return ${approved ? 'approved' : 'rejected'} — Order #${order.id}`, html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Return resolved email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── New return request alert (staff) ─────────────────────────
async function sendReturnRequestAlertToStaff({ order, clientName, reason }) {
  const notifyTo = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !notifyTo) return { sent: false, reason: 'SMTP not configured' };
  const ordersUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/returns`;
  const html = buildNoticeEmail({
    heading: '↩️ New return request',
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>${escapeHtml(clientName)}</strong> requested a return for order <strong>#${order.id}</strong>.</p>
      <p style="margin:0;color:#64748b;font-size:13px;">Reason: "${escapeHtml(reason)}"</p>
    `,
    ctaLabel: 'Review return',
    ctaUrl: ordersUrl,
  });
  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`, to: notifyTo,
      subject: `↩️ Return requested — Order #${order.id}`, html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Return request alert email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Client cancelled their own pending order (staff alert) ──
async function sendClientCancelledOrderAlertToStaff({ order, clientName, reason }) {
  const notifyTo = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !notifyTo) return { sent: false, reason: 'SMTP not configured' };
  const ordersUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders`;
  const html = buildNoticeEmail({
    heading: '❌ Order cancelled by client',
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong>${escapeHtml(clientName)}</strong> cancelled their pending order <strong>#${order.id}</strong> before it was confirmed.</p>
      <p style="margin:0;color:#64748b;font-size:13px;">Reason: "${escapeHtml(reason)}"</p>
    `,
    ctaLabel: 'View orders',
    ctaUrl: ordersUrl,
  });
  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`, to: notifyTo,
      subject: `❌ Order #${order.id} cancelled by client`, html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Client-cancelled order alert email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Low stock alert (staff) ──────────────────────────────────
async function sendLowStockAlertToStaff({ products }) {
  const notifyTo = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !notifyTo) return { sent: false, reason: 'SMTP not configured' };
  if (!products || products.length === 0) return { sent: false, reason: 'No products' };
  const productsUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/products?low_stock=true`;

  const itemsHtml = products.map(p => `
    <li style="margin-bottom:4px;">
      <strong>${escapeHtml(p.name)}</strong>${p.reference ? ` (${escapeHtml(p.reference)})` : ''} —
      <span style="color:#dc2626;font-weight:700;">${p.stock} left</span>
    </li>
  `).join('');

  const html = buildNoticeEmail({
    heading: '📉 Low stock alert',
    bodyHtml: `
      <p style="margin:0 0 12px;">The following product${products.length > 1 ? 's are' : ' is'} running low on stock:</p>
      <ul style="margin:0 0 12px;padding-left:18px;font-size:13px;color:#374151;">${itemsHtml}</ul>
      <p style="margin:0;color:#94a3b8;font-size:12px;">Consider restocking soon to avoid missed sales.</p>
    `,
    ctaLabel: 'View low stock products',
    ctaUrl: productsUrl,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: notifyTo,
      subject: `📉 Low stock alert — ${products.length} product${products.length > 1 ? 's' : ''}`,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Low stock alert email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── Reorder-level alert ─────────────────────────────────────────────────────
// Fired after stock is decremented when a product (or variant) now sits AT or
// BELOW its configured reorder_level. Distinct from the low-stock threshold
// alert: this one is per-product and tells staff to create a purchase order.
async function sendReorderAlertToStaff({ products }) {
  const notifyTo = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !notifyTo) return { sent: false, reason: 'SMTP not configured' };
  if (!products || products.length === 0) return { sent: false, reason: 'No products' };
  const poUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/purchase-orders`;

  const itemsHtml = products.map(p => `
    <li style="margin-bottom:4px;">
      <strong>${escapeHtml(p.name)}</strong>${p.reference ? ` (${escapeHtml(p.reference)})` : ''} —
      <span style="color:#dc2626;font-weight:700;">${p.stock} left</span>
      (reorder level: ${p.reorderLevel})
    </li>
  `).join('');

  const html = buildNoticeEmail({
    heading: '🔔 Reorder required',
    bodyHtml: `
      <p style="margin:0 0 12px;">Stock has reached the reorder threshold for the following product${products.length > 1 ? 's' : ''}:</p>
      <ul style="margin:0 0 12px;padding-left:18px;font-size:13px;color:#374151;">${itemsHtml}</ul>
      <p style="margin:0;color:#94a3b8;font-size:12px;">Create a purchase order to restock before you run out.</p>
    `,
    ctaLabel: 'Create purchase order',
    ctaUrl: poUrl,
  });

  try {
    const info = await transporter.sendMail({
      from: `"Sales Manager" <${process.env.SMTP_USER}>`,
      to: notifyTo,
      subject: `🔔 Reorder required — ${products.length} product${products.length > 1 ? 's' : ''}`,
      html,
    });
    return { sent: true, messageId: info.messageId };
  } catch (err) {
    console.error('❌ Reorder alert email failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = {
  sendOrderStatusEmail,
  buildOrderPlacedEmail,
  sendPasswordResetEmail,
  sendClientRegistrationEmail,
  sendClientApprovedEmail,
  sendPaymentReceivedEmail,
  sendPaymentFailedEmail,
  sendBankTransferPendingEmail,
  sendNewOrderAlertToStaff,
  sendReturnRequestedEmail,
  sendReturnResolvedEmail,
  sendReturnRequestAlertToStaff,
  sendClientCancelledOrderAlertToStaff,
  sendLowStockAlertToStaff,
  sendReorderAlertToStaff,
};
