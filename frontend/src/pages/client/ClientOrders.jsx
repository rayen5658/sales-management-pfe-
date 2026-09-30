import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LuArrowLeft, LuEye, LuRefreshCw, LuShoppingCart, LuCreditCard, LuLandmark, LuCopy, LuUndo2, LuStar, LuCircleX } from 'react-icons/lu';
import { useClientAuthStore } from '../../stores/clientAuthStore';
import { clientPortalService } from '../../services/clientApi';
import { notifySuccess, notifyError, setupToasterGlobal } from '../../utils/uxHelpers';
import DarkModeToggle from '../../components/common/DarkModeToggle';

import { CART_STORAGE_KEY } from '../../utils/constants';

const STATUS = {
  pending:   { label: 'Pending',   color: '#92400e', bg: '#fef3c7' },
  confirmed: { label: 'Confirmed', color: '#1e40af', bg: '#dbeafe' },
  shipped:   { label: 'Shipped',   color: '#5b21b6', bg: '#ede9fe' },
  delivered: { label: 'Delivered', color: '#166534', bg: '#dcfce7' },
  cancelled: { label: 'Cancelled', color: '#991b1b', bg: '#fee2e2' },
};

const PAYMENT_STATUS = {
  unpaid:  { label: 'Unpaid',           color: '#92400e', bg: '#fef3c7' },
  pending: { label: 'Payment pending',  color: '#1e40af', bg: '#dbeafe' },
  paid:    { label: 'Paid',             color: '#166534', bg: '#dcfce7' },
  failed:  { label: 'Payment failed',   color: '#991b1b', bg: '#fee2e2' },
  refunded:{ label: 'Refunded',         color: '#5b21b6', bg: '#ede9fe' },
};

const STATUS_FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];

const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

export default function ClientOrders() {
  const navigate = useNavigate();
  const { client } = useClientAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [detail, setDetail]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reorderLoading, setReorderLoading] = useState(null); // order id being reordered
  const [payLoading, setPayLoading] = useState(null); // order id currently starting payment
  const [paymentMethods, setPaymentMethods] = useState({ konnect: { enabled: false }, bank_transfer: { enabled: false } });
  const [bankModal, setBankModal] = useState(null); // order the bank-transfer modal is open for
  const [bankConfirmLoading, setBankConfirmLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(null); // order the cancel modal is open for
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Return / feedback (shown inside the detail modal, for delivered orders)
  const [returnStatus, setReturnStatus] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  useEffect(() => {
    clientPortalService.getOrders()
      .then(r => setOrders(r.data))
      .catch(() => setError('Error loading orders'))
      .finally(() => setLoading(false));

    clientPortalService.getPaymentAvailability()
      .then(r => setPaymentMethods(r.data))
      .catch(() => {});
  }, []);

  // Handle the redirect back from Konnect (?payment=success|failed|error&order=ID)
  useEffect(() => {
    const payment = searchParams.get('payment');
    if (!payment) return;

    const orderId = searchParams.get('order');
    if (payment === 'success') notifySuccess(orderId ? `Payment successful for order ${orderId}!` : 'Payment successful!');
    else if (payment === 'failed') notifyError(orderId ? `Payment failed for order ${orderId}. You can try again.` : 'Payment failed.');
    else notifyError('Something went wrong confirming your payment. Please check your order status below.');

    setSearchParams({}, { replace: true });
    // Refresh orders to pick up the new payment_status
    clientPortalService.getOrders().then(r => setOrders(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async (order) => {
    setPayLoading(order.id);
    try {
      const r = await clientPortalService.payOrder(order.id);
      window.location.href = r.data.payUrl;
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not start payment. Please try again.');
      setPayLoading(null);
    }
  };

  const handleConfirmBankTransfer = async () => {
    if (!bankModal) return;
    setBankConfirmLoading(true);
    try {
      await clientPortalService.payByTransfer(bankModal.id);
      notifySuccess('Got it — mark your order as paid once the seller confirms your transfer.');
      setBankModal(null);
      clientPortalService.getOrders().then(r => setOrders(r.data)).catch(() => {});
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not record your payment choice. Please try again.');
    } finally {
      setBankConfirmLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelModal || !cancelReason.trim()) return;
    setCancelLoading(true);
    try {
      await clientPortalService.cancelOrder(cancelModal.id, cancelReason.trim());
      notifySuccess('Order cancelled');
      setCancelModal(null);
      setCancelReason('');
      clientPortalService.getOrders().then(r => setOrders(r.data)).catch(() => {});
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not cancel order. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleRequestReturn = async () => {
    if (!detail?.order || !returnReason.trim()) return;
    setReturnLoading(true);
    try {
      const r = await clientPortalService.requestReturn(detail.order.id, returnReason.trim());
      setReturnStatus(r.data.return);
      notifySuccess('Return request submitted');
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not submit return request');
    } finally {
      setReturnLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!detail?.order || !feedbackRating) return;
    setFeedbackLoading(true);
    try {
      const r = await clientPortalService.submitFeedback(detail.order.id, { rating: feedbackRating, comment: feedbackComment.trim() || undefined });
      setFeedbackStatus(r.data.feedback);
      notifySuccess('Thanks for your feedback!');
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not submit feedback');
    } finally {
      setFeedbackLoading(false);
    }
  };

  const getOrderTime = (order) => new Date(order?.order_date || order?.created_at || 0).getTime();
  const sortedOrders = [...orders].sort((a, b) => getOrderTime(b) - getOrderTime(a));

  const openDetail = async (order, orderNumber) => {
    setDetailLoading(true);
    setDetail({ order, lines: [], history: [], orderNumber });
    setReturnStatus(null);
    setFeedbackStatus(null);
    setReturnReason('');
    setFeedbackRating(0);
    setFeedbackComment('');
    try {
      const r = await clientPortalService.getOrderById(order.id);
      setDetail({ ...r.data, orderNumber });
      if (order.status === 'delivered') {
        clientPortalService.getReturnStatus(order.id).then(res => setReturnStatus(res.data)).catch(() => {});
        clientPortalService.getFeedbackStatus(order.id).then(res => setFeedbackStatus(res.data)).catch(() => {});
      }
    } catch {
      setError('Error loading order details');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReorder = async (order) => {
    setReorderLoading(order.id);
    try {
      // Fetch the order lines
      const r = await clientPortalService.getOrderById(order.id);
      const lines = r.data?.lines || [];
      if (lines.length === 0) {
        notifyError('No items found in this order');
        return;
      }

      // Fetch current product data to get fresh stock & prices
      const productsRes = await clientPortalService.getProducts({});
      const productMap = {};
      (productsRes.data || []).forEach(p => { productMap[p.id] = p; });

      // Build cart entries — only add products still in stock
      const newCart = {};
      let skipped = 0;
      lines.forEach(line => {
        const product = productMap[line.product_id];
        if (!product || product.stock <= 0) { skipped++; return; }
        const qty = Math.min(line.quantity, product.stock);
        newCart[product.id] = { product, quantity: qty };
      });

      if (Object.keys(newCart).length === 0) {
        notifyError('None of the items are currently in stock');
        return;
      }

      // Save to localStorage and navigate to portal
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
      notifySuccess(
        skipped > 0
          ? `Cart filled with ${Object.keys(newCart).length} item(s). ${skipped} out-of-stock item(s) skipped.`
          : `${Object.keys(newCart).length} item(s) added to your cart!`
      );
      navigate('/client/portal');
    } catch {
      notifyError('Error loading order items. Please try again.');
    } finally {
      setReorderLoading(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {setupToasterGlobal()}

      {/* Top bar */}
      <header style={{
        background: 'var(--card-bg)', borderBottom: '1px solid var(--border)',
        padding: '0 1.5rem', height: 60,
        display: 'flex', alignItems: 'center', gap: '1rem',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <button
          onClick={() => navigate('/client/portal')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}
        >
          <LuArrowLeft size={16} /> Back to catalog
        </button>
        <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
          My Orders — {client?.company_name}
        </h1>
        <div style={{ marginLeft: 'auto' }}>
          <DarkModeToggle size={36} />
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#991b1b', fontSize: '0.875rem' }}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-faint)' }}>Loading orders...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-faint)' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</p>
            <p>No orders yet. <span style={{ color: '#0d9488', cursor: 'pointer' }} onClick={() => navigate('/client/portal')}>Browse the catalog →</span></p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sortedOrders.map((order, index) => {
              const s = STATUS[order.status] || { label: order.status, color: '#475569', bg: 'var(--border)' };
              const ps = PAYMENT_STATUS[order.payment_status] || PAYMENT_STATUS.unpaid;
              const canPay = order.status !== 'cancelled' && order.payment_status !== 'paid';
              const canPayKonnect = canPay && paymentMethods.konnect?.enabled;
              const canPayBank = canPay && paymentMethods.bank_transfer?.enabled;
              const orderNumber = index + 1;
              return (
                <div key={order.id} style={{
                  background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border)',
                  padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>Order {orderNumber}</span>
                        <span style={{ background: s.bg, color: s.color, padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {s.label}
                        </span>
                        <span style={{ background: ps.bg, color: ps.color, padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {ps.label}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        {order.order_date ? new Date(order.order_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                      </p>
                      {order.cancel_reason && (
                        <p style={{ fontSize: '0.78rem', color: '#991b1b', marginTop: '0.3rem' }}>
                          Reason: {order.cancel_reason}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0d9488', margin: 0 }}>{fmt(order.amount_ttc)}</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', margin: 0 }}>inc. tax</p>
                      </div>
                      <button
                        onClick={() => openDetail(order, orderNumber)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.45rem 0.85rem', border: '1.5px solid var(--border)',
                          borderRadius: '8px', background: 'var(--card-bg)', cursor: 'pointer',
                          fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)',
                        }}
                      >
                        <LuEye size={13} /> Details
                      </button>
                      {canPayKonnect && (
                        <button
                          onClick={() => handlePay(order)}
                          disabled={payLoading === order.id}
                          title="Pay for this order online"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            padding: '0.45rem 0.85rem',
                            border: 'none',
                            borderRadius: '8px',
                            background: payLoading === order.id ? '#bbf7d0' : 'linear-gradient(135deg,#16a34a,#15803d)',
                            color: payLoading === order.id ? '#166534' : '#fff',
                            cursor: payLoading === order.id ? 'not-allowed' : 'pointer',
                            fontSize: '0.8rem', fontWeight: 700,
                            boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
                          }}
                        >
                          {payLoading === order.id
                            ? <><LuRefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Redirecting...</>
                            : <><LuCreditCard size={13} /> Pay Now</>
                          }
                        </button>
                      )}
                      {canPayBank && (
                        <button
                          onClick={() => setBankModal(order)}
                          title="Pay by bank transfer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            padding: '0.45rem 0.85rem',
                            border: '1.5px solid #f59e0b',
                            borderRadius: '8px',
                            background: 'transparent',
                            color: '#b45309',
                            cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 700,
                          }}
                        >
                          <LuLandmark size={13} /> {order.payment_method === 'bank_transfer' ? 'Bank Details' : 'Bank Transfer'}
                        </button>
                      )}
                      <button
                        onClick={() => handleReorder(order)}
                        disabled={reorderLoading === order.id}
                        title="Add all items from this order to your cart"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.45rem 0.85rem',
                          border: 'none',
                          borderRadius: '8px',
                          background: reorderLoading === order.id
                            ? '#99f6e4'
                            : 'linear-gradient(135deg,#0d9488,#0891b2)',
                          color: reorderLoading === order.id ? '#0d9488' : '#fff',
                          cursor: reorderLoading === order.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem', fontWeight: 700,
                          boxShadow: '0 2px 8px rgba(13,148,136,0.2)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {reorderLoading === order.id
                          ? <><LuRefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading...</>
                          : <><LuShoppingCart size={13} /> Reorder</>
                        }
                      </button>
                      {order.status === 'pending' && (
                        <button
                          onClick={() => { setCancelModal(order); setCancelReason(''); }}
                          title="Cancel this order"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.35rem',
                            padding: '0.45rem 0.85rem',
                            border: '1.5px solid #ef4444',
                            borderRadius: '8px',
                            background: 'transparent',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 700,
                          }}
                        >
                          <LuCircleX size={13} /> Cancel
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  {order.status !== 'cancelled' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: '1rem' }}>
                      {STATUS_FLOW.map((s, i) => {
                        const currentIdx = STATUS_FLOW.indexOf(order.status);
                        const isDone = i <= currentIdx;
                        const isCurrent = i === currentIdx;
                        return (
                          <React.Fragment key={s}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: '50%',
                                background: isDone ? '#0d9488' : 'var(--border)',
                                border: isCurrent ? '2px solid #0d9488' : '2px solid ' + (isDone ? '#0d9488' : 'var(--border)'),
                                boxShadow: isCurrent ? '0 0 0 3px rgba(13,148,136,0.2)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.6rem', color: isDone ? '#fff' : 'var(--text-faint)', fontWeight: 700,
                              }}>
                                {isDone ? '✓' : i + 1}
                              </div>
                              <span style={{ fontSize: '0.6rem', color: isDone ? '#0d9488' : 'var(--text-faint)', fontWeight: isCurrent ? 700 : 400, whiteSpace: 'nowrap' }}>
                                {STATUS[s]?.label}
                              </span>
                            </div>
                            {i < STATUS_FLOW.length - 1 && (
                              <div style={{ flex: 1, height: 2, background: i < STATUS_FLOW.indexOf(order.status) ? '#0d9488' : 'var(--border)', margin: '0 3px', marginBottom: '1rem', borderRadius: 2 }} />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Detail modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setDetail(null)}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--card-bg)', zIndex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)' }}>
                Order {detail.orderNumber} Details
              </h2>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}>✕</button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {detailLoading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>Loading...</p>
              ) : (
                <>
                  {/* Order lines */}
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Items</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        {['Product', 'Qty', 'Unit Price', 'Subtotal'].map(h => (
                          <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: h === 'Product' ? 'left' : 'right', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.lines || []).map((line, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--card-bg-2)' }}>
                          <td style={{ padding: '0.55rem 0.5rem', fontWeight: 600 }}>{line.product_name}</td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{line.quantity}</td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(line.unit_price)}</td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#0d9488' }}>{fmt(line.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div style={{ background: 'var(--card-bg-2)', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                    {[
                      ['Subtotal (ex. tax)', fmt(detail.order?.amount_ht)],
                      ['Tax (19%)',          fmt(detail.order?.tva)],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        <span>{label}</span><span>{value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', fontWeight: 800, fontSize: '0.95rem' }}>
                      <span>Total (inc. tax)</span>
                      <span style={{ color: '#0d9488' }}>{fmt(detail.order?.amount_ttc)}</span>
                    </div>
                  </div>

                  {/* Status history */}
                  {detail.history && detail.history.length > 0 && (
                    <>
                      <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Status History</h4>
                      <div style={{ position: 'relative', paddingLeft: '1.25rem' }}>
                        <div style={{ position: 'absolute', left: '0.5rem', top: 0, bottom: 0, width: 2, background: 'var(--border)', borderRadius: 2 }} />
                        {detail.history.map((entry, i) => {
                          const s = STATUS[entry.new_status] || { color: '#475569', bg: 'var(--border)', label: entry.new_status };
                          return (
                            <div key={i} style={{ position: 'relative', paddingLeft: '0.85rem', marginBottom: i < detail.history.length - 1 ? '0.85rem' : 0 }}>
                              <div style={{ position: 'absolute', left: '-0.75rem', top: '0.2rem', width: 10, height: 10, borderRadius: '50%', background: s.color, border: '2px solid var(--card-bg)', boxShadow: '0 0 0 2px ' + s.color + '40' }} />
                              <div style={{ background: 'var(--card-bg-2)', borderRadius: '8px', padding: '0.6rem 0.85rem', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{ background: s.bg, color: s.color, padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>{s.label}</span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>
                                    {entry.changed_at ? new Date(entry.changed_at).toLocaleDateString('en-GB') + ' ' + new Date(entry.changed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                  </span>
                                </div>
                                {entry.notes && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.3rem 0 0', fontStyle: 'italic' }}>"{entry.notes}"</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {/* Return + feedback — delivered orders only */}
                  {detail.order?.status === 'delivered' && (
                    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                      {/* Return */}
                      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.9rem 1rem' }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <LuUndo2 size={13} /> Return
                        </h4>
                        {returnStatus === null ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              value={returnReason}
                              onChange={e => setReturnReason(e.target.value)}
                              placeholder="Reason for return..."
                              style={{ flex: 1, padding: '0.5rem 0.7rem', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: '0.82rem' }}
                            />
                            <button
                              onClick={handleRequestReturn}
                              disabled={!returnReason.trim() || returnLoading}
                              style={{ padding: '0.5rem 0.9rem', border: 'none', borderRadius: '8px', background: !returnReason.trim() ? 'var(--border)' : 'linear-gradient(135deg,#f97316,#c2410c)', color: '#fff', cursor: !returnReason.trim() ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                            >
                              {returnLoading ? 'Sending…' : 'Request return'}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <span style={{
                              background: returnStatus.status === 'approved' ? '#dcfce7' : returnStatus.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                              color: returnStatus.status === 'approved' ? '#166534' : returnStatus.status === 'rejected' ? '#991b1b' : '#92400e',
                              padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize',
                            }}>{returnStatus.status}</span>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>"{returnStatus.reason}"</p>
                            {returnStatus.resolution_note && <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', margin: '0.3rem 0 0', fontStyle: 'italic' }}>Seller note: "{returnStatus.resolution_note}"</p>}
                          </div>
                        )}
                      </div>

                      {/* Feedback */}
                      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '0.9rem 1rem' }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <LuStar size={13} /> Feedback
                        </h4>
                        {feedbackStatus === null ? (
                          <div>
                            <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '0.6rem' }}>
                              {[1, 2, 3, 4, 5].map(n => (
                                <LuStar
                                  key={n}
                                  size={22}
                                  onClick={() => setFeedbackRating(n)}
                                  style={{ cursor: 'pointer' }}
                                  fill={n <= feedbackRating ? '#eab308' : 'none'}
                                  color={n <= feedbackRating ? '#eab308' : 'var(--border)'}
                                />
                              ))}
                            </div>
                            <textarea
                              value={feedbackComment}
                              onChange={e => setFeedbackComment(e.target.value)}
                              placeholder="Optional comment..."
                              rows={2}
                              style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: '0.82rem', marginBottom: '0.6rem', resize: 'vertical' }}
                            />
                            <button
                              onClick={handleSubmitFeedback}
                              disabled={!feedbackRating || feedbackLoading}
                              style={{ padding: '0.5rem 0.9rem', border: 'none', borderRadius: '8px', background: !feedbackRating ? 'var(--border)' : 'linear-gradient(135deg,#eab308,#a16207)', color: '#fff', cursor: !feedbackRating ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                            >
                              {feedbackLoading ? 'Sending…' : 'Submit feedback'}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', gap: '1px', marginBottom: '0.4rem' }}>
                              {[1, 2, 3, 4, 5].map(n => (
                                <LuStar key={n} size={16} fill={n <= feedbackStatus.rating ? '#eab308' : 'none'} color={n <= feedbackStatus.rating ? '#eab308' : 'var(--border)'} />
                              ))}
                            </div>
                            {feedbackStatus.comment && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>"{feedbackStatus.comment}"</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDetail(null)} style={{ padding: '0.55rem 1.25rem', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bank transfer modal */}
      {bankModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setBankModal(null)}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LuLandmark size={18} /> Pay by Bank Transfer
              </h2>
              <button onClick={() => setBankModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0 }}>
                Transfer <strong style={{ color: 'var(--text)' }}>{fmt(bankModal.amount_ttc)}</strong> to the account below, then confirm — the seller will mark your order paid once the funds arrive.
              </p>
              <div style={{ background: 'var(--card-bg-2)', borderRadius: '10px', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {paymentMethods.bank_transfer?.bankName && (
                  <div><span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bank</span>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{paymentMethods.bank_transfer.bankName}</p></div>
                )}
                <div><span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>RIB / IBAN</span>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {paymentMethods.bank_transfer?.rib}
                    <LuCopy
                      size={13}
                      style={{ cursor: 'pointer', color: 'var(--text-faint)' }}
                      title="Copy"
                      onClick={() => { navigator.clipboard?.writeText(paymentMethods.bank_transfer?.rib || ''); notifySuccess('RIB copied'); }}
                    />
                  </p>
                </div>
                {paymentMethods.bank_transfer?.holder && (
                  <div><span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Account Holder</span>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>{paymentMethods.bank_transfer.holder}</p></div>
                )}
                {paymentMethods.bank_transfer?.instructions && (
                  <div><span style={{ fontSize: '0.7rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Note</span>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{paymentMethods.bank_transfer.instructions}</p></div>
                )}
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button onClick={() => setBankModal(null)} style={{ padding: '0.55rem 1.1rem', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button
                onClick={handleConfirmBankTransfer}
                disabled={bankConfirmLoading}
                style={{ padding: '0.55rem 1.1rem', border: 'none', borderRadius: '8px', background: 'linear-gradient(135deg,#f59e0b,#b45309)', color: '#fff', cursor: bankConfirmLoading ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {bankConfirmLoading ? 'Saving…' : "I've sent the transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cancel order modal */}
      {cancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => !cancelLoading && setCancelModal(null)}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LuCircleX size={18} color="#dc2626" /> Cancel Order
              </h2>
              <button onClick={() => setCancelModal(null)} disabled={cancelLoading} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 0 }}>
                This order hasn&apos;t been confirmed yet — cancelling it is final and can&apos;t be undone.
              </p>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                Cancellation reason *
              </label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling this order? (required)"
                rows={3}
                style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'var(--card-bg)', color: 'var(--text)', fontSize: '0.85rem', resize: 'vertical' }}
              />
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button onClick={() => setCancelModal(null)} disabled={cancelLoading} style={{ padding: '0.55rem 1.1rem', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'var(--card-bg)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Back
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={!cancelReason.trim() || cancelLoading}
                style={{ padding: '0.55rem 1.1rem', border: 'none', borderRadius: '8px', background: !cancelReason.trim() ? 'var(--border)' : 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', cursor: !cancelReason.trim() ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              >
                {cancelLoading ? 'Cancelling…' : 'Confirm cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
