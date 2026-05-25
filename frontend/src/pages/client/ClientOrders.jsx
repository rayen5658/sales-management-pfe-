import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEye } from 'react-icons/fi';
import { useClientAuthStore } from '../../stores/clientAuthStore';
import { clientPortalService } from '../../services/clientApi';

const STATUS = {
  pending:   { label: 'Pending',   color: '#92400e', bg: '#fef3c7' },
  confirmed: { label: 'Confirmed', color: '#1e40af', bg: '#dbeafe' },
  shipped:   { label: 'Shipped',   color: '#5b21b6', bg: '#ede9fe' },
  delivered: { label: 'Delivered', color: '#166534', bg: '#dcfce7' },
  cancelled: { label: 'Cancelled', color: '#991b1b', bg: '#fee2e2' },
};

const STATUS_FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];

const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

export default function ClientOrders() {
  const navigate = useNavigate();
  const { client } = useClientAuthStore();

  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [detail, setDetail]     = useState(null); // { order, lines, history }
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    clientPortalService.getOrders()
      .then(r => setOrders(r.data))
      .catch(() => setError('Error loading orders'))
      .finally(() => setLoading(false));
  }, []);

  const openDetail = async (order) => {
    setDetailLoading(true);
    setDetail({ order, lines: [], history: [] });
    try {
      const r = await clientPortalService.getOrderById(order.id);
      setDetail(r.data);
    } catch {
      setError('Error loading order details');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Top bar */}
      <header style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 1.5rem', height: 60,
        display: 'flex', alignItems: 'center', gap: '1rem',
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <button
          onClick={() => navigate('/client/portal')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6b7280', fontSize: '0.875rem' }}
        >
          <FiArrowLeft size={16} /> Back to catalog
        </button>
        <div style={{ width: 1, height: 24, background: '#e2e8f0' }} />
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e1b4b' }}>
          My Orders — {client?.company_name}
        </h1>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem' }}>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.85rem 1.25rem', marginBottom: '1rem', color: '#991b1b', fontSize: '0.875rem' }}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>Loading orders...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#9ca3af' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</p>
            <p>No orders yet. <span style={{ color: '#4f46e5', cursor: 'pointer' }} onClick={() => navigate('/client/portal')}>Browse the catalog →</span></p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {orders.map(order => {
              const s = STATUS[order.status] || { label: order.status, color: '#475569', bg: '#f1f5f9' };
              return (
                <div key={order.id} style={{
                  background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0',
                  padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e1b4b' }}>Order #{order.id}</span>
                        <span style={{ background: s.bg, color: s.color, padding: '0.15rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {s.label}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
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
                        <p style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4f46e5', margin: 0 }}>{fmt(order.amount_ttc)}</p>
                        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: 0 }}>inc. tax</p>
                      </div>
                      <button
                        onClick={() => openDetail(order)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.45rem 0.85rem', border: '1.5px solid #e2e8f0',
                          borderRadius: '8px', background: '#fff', cursor: 'pointer',
                          fontSize: '0.8rem', fontWeight: 600, color: '#374151',
                        }}
                      >
                        <FiEye size={13} /> Details
                      </button>
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
                                background: isDone ? '#4f46e5' : '#e2e8f0',
                                border: isCurrent ? '2px solid #4f46e5' : '2px solid ' + (isDone ? '#4f46e5' : '#e2e8f0'),
                                boxShadow: isCurrent ? '0 0 0 3px rgba(79,70,229,0.2)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.6rem', color: isDone ? '#fff' : '#94a3b8', fontWeight: 700,
                              }}>
                                {isDone ? '✓' : i + 1}
                              </div>
                              <span style={{ fontSize: '0.6rem', color: isDone ? '#4f46e5' : '#9ca3af', fontWeight: isCurrent ? 700 : 400, whiteSpace: 'nowrap' }}>
                                {STATUS[s]?.label}
                              </span>
                            </div>
                            {i < STATUS_FLOW.length - 1 && (
                              <div style={{ flex: 1, height: 2, background: i < STATUS_FLOW.indexOf(order.status) ? '#4f46e5' : '#e2e8f0', margin: '0 3px', marginBottom: '1rem', borderRadius: 2 }} />
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
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e1b4b' }}>
                Order #{detail.order?.id}
              </h2>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#6b7280' }}>✕</button>
            </div>

            <div style={{ padding: '1.25rem 1.5rem' }}>
              {detailLoading ? (
                <p style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>Loading...</p>
              ) : (
                <>
                  {/* Order lines */}
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Items</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                        {['Product', 'Qty', 'Unit Price', 'Subtotal'].map(h => (
                          <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: h === 'Product' ? 'left' : 'right', color: '#6b7280', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(detail.lines || []).map((line, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '0.55rem 0.5rem', fontWeight: 600 }}>{line.product_name}</td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right' }}>{line.quantity}</td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', color: '#6b7280' }}>{fmt(line.unit_price)}</td>
                          <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{fmt(line.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                    {[
                      ['Subtotal (ex. tax)', fmt(detail.order?.amount_ht)],
                      ['Tax (19%)',          fmt(detail.order?.tva)],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.35rem' }}>
                        <span>{label}</span><span>{value}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.95rem' }}>
                      <span>Total (inc. tax)</span>
                      <span style={{ color: '#4f46e5' }}>{fmt(detail.order?.amount_ttc)}</span>
                    </div>
                  </div>

                  {/* Status history */}
                  {detail.history && detail.history.length > 0 && (
                    <>
                      <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Status History</h4>
                      <div style={{ position: 'relative', paddingLeft: '1.25rem' }}>
                        <div style={{ position: 'absolute', left: '0.5rem', top: 0, bottom: 0, width: 2, background: '#e2e8f0', borderRadius: 2 }} />
                        {detail.history.map((entry, i) => {
                          const s = STATUS[entry.new_status] || { color: '#475569', bg: '#f1f5f9', label: entry.new_status };
                          return (
                            <div key={i} style={{ position: 'relative', paddingLeft: '0.85rem', marginBottom: i < detail.history.length - 1 ? '0.85rem' : 0 }}>
                              <div style={{ position: 'absolute', left: '-0.75rem', top: '0.2rem', width: 10, height: 10, borderRadius: '50%', background: s.color, border: '2px solid #fff', boxShadow: '0 0 0 2px ' + s.color + '40' }} />
                              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.6rem 0.85rem', border: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <span style={{ background: s.bg, color: s.color, padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>{s.label}</span>
                                  <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                                    {entry.changed_at ? new Date(entry.changed_at).toLocaleDateString('en-GB') + ' ' + new Date(entry.changed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                  </span>
                                </div>
                                {entry.notes && <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.3rem 0 0', fontStyle: 'italic' }}>"{entry.notes}"</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDetail(null)} style={{ padding: '0.55rem 1.25rem', border: '1.5px solid #e2e8f0', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
