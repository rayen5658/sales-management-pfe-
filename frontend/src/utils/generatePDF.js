import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (v) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(v || 0)) + ' TND';

const STATUS_LABELS = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  shipped:   'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function generateInvoicePDF(order, lines) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // ── Colors ──
  const PRIMARY   = [79, 70, 229];   // indigo
  const DARK      = [30, 41, 59];
  const MUTED     = [100, 116, 139];
  const LIGHT_BG  = [248, 250, 252];
  const WHITE     = [255, 255, 255];

  // ── Header band ──
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 38, 'F');

  // Company name
  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SalesManager', 14, 16);

  // Subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Sales Management Application — Dynamix Services', 14, 23);

  // INVOICE label on the right
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageW - 14, 18, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${String(order.id).padStart(5, '0')}`, pageW - 14, 26, { align: 'right' });

  // ── Info row ──
  doc.setTextColor(...DARK);
  doc.setFontSize(9);

  // Left — client info
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(14, 44, 85, 38, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('BILLED TO', 19, 51);
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(order.client_name || '—', 19, 58);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Sales Rep: ${order.user_firstname || ''} ${order.user_lastname || ''}`.trim(), 19, 65);
  doc.text(`Client ID: ${order.client_id}`, 19, 71);

  // Right — order info
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(pageW - 99, 44, 85, 38, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('ORDER DETAILS', pageW - 94, 51);
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const orderDate = order.order_date
    ? new Date(order.order_date).toLocaleDateString('en-GB')
    : '—';

  const infoRows = [
    ['Date:', orderDate],
    ['Status:', STATUS_LABELS[order.status] || order.status],
    ['Ref.:', `ORD-${String(order.id).padStart(5, '0')}`],
  ];
  infoRows.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, pageW - 94, 58 + i * 7);
    doc.setFont('helvetica', 'normal');
    doc.text(value, pageW - 75, 58 + i * 7);
  });

  // ── Lines table ──
  const tableRows = lines.map((l, i) => [
    i + 1,
    l.product_reference || '—',
    l.product_name || '—',
    l.quantity,
    fmt(l.unit_price),
    fmt(l.subtotal),
  ]);

  autoTable(doc, {
    startY: 90,
    head: [['#', 'Reference', 'Description', 'Qty', 'Unit Price (ex. tax)', 'Subtotal (ex. tax)']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: PRIMARY,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: DARK,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 35 },
      5: { halign: 'right', cellWidth: 35 },
    },
    alternateRowStyles: { fillColor: LIGHT_BG },
    margin: { left: 14, right: 14 },
  });

  // ── Totals block ──
  const finalY = doc.lastAutoTable.finalY + 8;
  const totalsX = pageW - 14 - 80;

  const totals = [
    { label: 'Amount (ex. tax)', value: fmt(order.amount_ht),  bold: false },
    { label: 'Tax (19%)',        value: fmt(order.tva),         bold: false },
    { label: 'TOTAL (INC. TAX)', value: fmt(order.amount_ttc),  bold: true  },
  ];

  totals.forEach((t, i) => {
    const y = finalY + i * 9;
    if (t.bold) {
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(totalsX - 2, y - 5, 82, 9, 2, 2, 'F');
      doc.setTextColor(...WHITE);
    } else {
      doc.setFillColor(...LIGHT_BG);
      doc.rect(totalsX - 2, y - 5, 82, 9, 'F');
      doc.setTextColor(...DARK);
    }
    doc.setFont('helvetica', t.bold ? 'bold' : 'normal');
    doc.setFontSize(t.bold ? 10 : 9);
    doc.text(t.label, totalsX + 2, y);
    doc.text(t.value, pageW - 16, y, { align: 'right' });
  });

  // ── Cancel reason (if any) ──
  if (order.cancel_reason) {
    const noteY = finalY + totals.length * 9 + 10;
    doc.setFillColor(254, 226, 226);
    doc.roundedRect(14, noteY, pageW - 28, 12, 2, 2, 'F');
    doc.setTextColor(153, 27, 27);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Cancellation reason:', 19, noteY + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(order.cancel_reason, 60, noteY + 7);
  }

  // ── Footer ──
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(14, footerY - 6, pageW - 14, footerY - 6);
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('SalesManager — Dynamix Services', 14, footerY);
  doc.text(`Document generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`, pageW - 14, footerY, { align: 'right' });

  // ── Save ──
  doc.save(`Invoice-ORD-${String(order.id).padStart(5, '0')}.pdf`);
}
