import React, { useEffect, useState } from 'react';
import { FiPlus, FiEye, FiXCircle, FiRefreshCw, FiFileText, FiEdit2, FiClock } from 'react-icons/fi';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import { orderService } from '../services/api';
import { generateInvoicePDF } from '../utils/generatePDF';
import '../styles/pages.css';

const STATUS = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const STATUS_FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];

const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

export default function OrdersPage() {
  const { orders, fetchOrders, ordersLoading, createOrder, cancelOrder, clients, fetchClients, products, fetchProducts } = useDataStore();
  const { user } = useAuthStore();
  const [pdfLoading, setPdfLoading] = useState(null);

  // Filters
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [minAmount, setMinAmount]     = useState('');
  const [maxAmount, setMaxAmount]     = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Modals
  const [showCreate, setShowCreate]   = useState(false);
  const [showDetail, setShowDetail]   = useState(null);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [editModal, setEditModal]     = useState(null); // order being edited
  const [editLines, setEditLines]     = useState([]);
  const [editClient, setEditClient]   = useState('');

  // Tracking modal
  const [trackingModal, setTrackingModal] = useState(null); // { order, history, lines, summary }
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Create form
  const [selectedClient, setSelectedClient] = useState('');
  const [lines, setLines] = useState([{ product_id: '', quantity: 1 }]);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchOrders(); fetchClients(); fetchProducts(); }, []);

  // Apply all filters client-side (data already loaded)
  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search);
    const matchStatus = !filterStatus || o.status === filterStatus;
    const matchClient = !filterClient || String(o.client_id) === filterClient;
    const matchDateFrom = !dateFrom || new Date(o.order_date) >= new Date(dateFrom);
    const matchDateTo   = !dateTo   || new Date(o.order_date) <= new Date(dateTo + 'T23:59:59');
    const matchMin = !minAmount || parseFloat(o.amount_ttc) >= parseFloat(minAmount);
    const matchMax = !maxAmount || parseFloat(o.amount_ttc) <= parseFloat(maxAmount);
    return matchSearch && matchStatus && matchClient && matchDateFrom && matchDateTo && matchMin && matchMax;
  });

  const hasActiveFilters = filterStatus || filterClient || dateFrom || dateTo || minAmount || maxAmount;

  const resetFilters = () => {
    setFilterStatus(''); setFilterClient('');
    setDateFrom(''); setDateTo('');
    setMinAmount(''); setMaxAmount('');
    setSearch('');
  };

  const addLine = () => setLines(l => [...l, { product_id: '', quantity: 1 }]);
  const removeLine = i => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, field, val) => setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: val } : line));

  const calcHT = () => lines.reduce((sum, line) => {
    const p = products.find(p => String(p.id) === String(line.product_id));
    return sum + (p ? parseFloat(p.unit_price) * parseInt(line.quantity || 0) : 0);
  }, 0);

  const handleCreate = async e => {
    e.preventDefault();
    setError('');
    if (!selectedClient) { setError('Select a client'); return; }
    if (lines.some(l => !l.product_id || !l.quantity || l.quantity < 1)) { setError('Fill all product lines'); return; }
    try {
      await createOrder({ client_id: parseInt(selectedClient), user_id: user.id, items: lines.map(l => ({ product_id: parseInt(l.product_id), quantity: parseInt(l.quantity) })) });
      setSuccess('Order created successfully');
      setShowCreate(false);
      setSelectedClient('');
      setLines([{ product_id: '', quantity: 1 }]);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || 'Error during creation'); }
  };

  const handleCancel = async () => {
    try {
      await cancelOrder(cancelModal, cancelReason || 'Cancelled by user');
      setSuccess('Order cancelled — stock restored');
      setCancelModal(null);
      setCancelReason('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || 'Error during cancellation'); }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await orderService.updateStatus(id, status);
      setSuccess(`Status updated: ${STATUS[status]}`);
      fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || 'Error'); }
  };

  const openEdit = async (order) => {
    setError('');
    try {
      const r = await orderService.getById(order.id);
      const { lines } = r.data;
      setEditModal(order);
      setEditClient(String(order.client_id));
      setEditLines(lines.map(l => ({ product_id: String(l.product_id), quantity: l.quantity })));
    } catch { setError('Error loading order'); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!editClient) { setError('Select a client'); return; }
    if (editLines.some(l => !l.product_id || !l.quantity)) { setError('Fill all lines'); return; }
    try {
      await orderService.update(editModal.id, {
        client_id: parseInt(editClient),
        items: editLines.map(l => ({ product_id: parseInt(l.product_id), quantity: parseInt(l.quantity) })),
      });
      setSuccess('Order updated successfully');
      setEditModal(null);
      fetchOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || 'Error during update'); }
  };

  const handleGeneratePDF = async (orderId) => {
    setPdfLoading(orderId);
    try {
      const response = await orderService.getById(orderId);
      const { order, lines } = response.data;
      generateInvoicePDF(order, lines);
    } catch (err) {
      setError('Error generating PDF');
    } finally {
      setPdfLoading(null);
    }
  };

  const handleViewTracking = async (order) => {
    setTrackingLoading(true);
    setTrackingModal({ order, history: [], lines: [], summary: null });
    try {
      const response = await orderService.getTracking(order.id);
      setTrackingModal({ order, ...response.data });
    } catch {
      setError('Error loading order tracking');
      setTrackingModal(null);
    } finally {
      setTrackingLoading(false);
    }
  };

  const ht = calcHT();
  const tva = ht * 0.19;
  const ttc = ht + tva;

  return (
    <div className="page">
      <div className="page-header">
        <h1>🛒 Orders <span className="count">{orders.length}</span></h1>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setError(''); }}><FiPlus /> New Order</button>
      </div>

      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && !showCreate && !cancelModal && <div className="alert alert-error">⚠ {error}</div>}

      <div className="toolbar">
        <input placeholder="Search by client or order #..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button
          className={`btn ${hasActiveFilters ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          🔍 Advanced filters {hasActiveFilters && '●'}
        </button>
        {hasActiveFilters && (
          <button className="btn btn-ghost" onClick={resetFilters} title="Reset filters">✕ Reset</button>
        )}
      </div>

      {/* Advanced filters panel */}
      {filtersOpen && (
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Client</label>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}>
              <option value="">All clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Start Date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>End Date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Min Amount (TND)</label>
            <input type="number" value={minAmount} onChange={e => setMinAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Max Amount (TND)</label>
            <input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="999999" />
          </div>
        </div>
      )}

      {/* Results count */}
      {hasActiveFilters && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} out of {orders.length} orders
        </p>
      )}

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No orders found</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Client</th><th>Date</th><th>Amount (ex. tax)</th><th>Tax</th><th>Total (inc. tax)</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id}>
                  <td><strong>#{o.id}</strong></td>
                  <td>{o.client_name || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{o.order_date ? new Date(o.order_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td>{fmt(o.amount_ht)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{fmt(o.tva)}</td>
                  <td><strong style={{ color: 'var(--primary)' }}>{fmt(o.amount_ttc)}</strong></td>
                  <td><span className={`badge badge-${o.status}`}>{STATUS[o.status] || o.status}</span></td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-ghost btn-icon" title="View details" onClick={() => setShowDetail(o)}><FiEye size={14} /></button>
                      <button className="btn btn-ghost btn-icon" title="Order tracking" onClick={() => handleViewTracking(o)}><FiClock size={14} /></button>
                      <button
                        className="btn btn-primary btn-icon"
                        title="Generate invoice PDF"
                        onClick={() => handleGeneratePDF(o.id)}
                        disabled={pdfLoading === o.id}
                      >
                        {pdfLoading === o.id ? '⟳' : <FiFileText size={14} />}
                      </button>
                      {(o.status === 'pending' || o.status === 'confirmed') && (
                        <button className="btn btn-warning btn-icon" title="Edit order" onClick={() => openEdit(o)}><FiEdit2 size={14} /></button>
                      )}
                      {o.status !== 'cancelled' && o.status !== 'delivered' && (
                        <button className="btn btn-success btn-icon" title="Advance status"
                          onClick={() => { const next = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1]; if (next) handleStatusUpdate(o.id, next); }}>
                          <FiRefreshCw size={14} />
                        </button>
                      )}
                      {o.status !== 'cancelled' && (
                        <button className="btn btn-danger btn-icon" title="Cancel" onClick={() => { setCancelModal(o.id); setError(''); }}><FiXCircle size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ New Order</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Client *</label>
                <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}>
                  <option value="">-- Select a client --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Order Lines *</label>
              </div>
              {lines.map((line, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <select value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)} style={{ padding: '0.55rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem', background: '#fff' }}>
                    <option value="">-- Product --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} — stock: {p.stock}</option>)}
                  </select>
                  <input type="number" min="1" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} style={{ padding: '0.55rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem' }} placeholder="Qty" />
                  {lines.length > 1 && <button type="button" className="btn btn-danger btn-icon" onClick={() => removeLine(i)}>✕</button>}
                </div>
              ))}
              <button type="button" className="btn btn-ghost" style={{ marginTop: '0.25rem', marginBottom: '1rem' }} onClick={addLine}><FiPlus /> Add a line</button>

              {ht > 0 && (
                <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '1rem', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.875rem' }}><span style={{ color: 'var(--text-muted)' }}>Amount (ex. tax)</span><strong>{fmt(ht)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.875rem' }}><span style={{ color: 'var(--text-muted)' }}>Tax (19%)</span><strong>{fmt(tva)}</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}><span style={{ fontWeight: 700 }}>Total (inc. tax)</span><strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{fmt(ttc)}</strong></div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={ordersLoading}>{ordersLoading ? 'Creating...' : 'Create Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Order #{showDetail.id}</h2>
              <button className="modal-close" onClick={() => setShowDetail(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                ['Client', showDetail.client_name || '—'],
                ['Sales Rep', `${showDetail.user_firstname || ''} ${showDetail.user_lastname || ''}`.trim() || '—'],
                ['Date', showDetail.order_date ? new Date(showDetail.order_date).toLocaleDateString('en-GB') : '—'],
                ['Status', <span className={`badge badge-${showDetail.status}`}>{STATUS[showDetail.status]}</span>],
                ['Amount (ex. tax)', fmt(showDetail.amount_ht)],
                ['Tax (19%)', fmt(showDetail.tva)],
                ['Total (inc. tax)', <strong style={{ color: 'var(--primary)' }}>{fmt(showDetail.amount_ttc)}</strong>],
                ...(showDetail.cancel_reason ? [['Cancellation reason', showDetail.cancel_reason]] : []),
              ].map(([label, value], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{label}</span>
                  <span style={{ fontSize: '0.875rem' }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDetail(null)}>Close</button>
              <button
                className="btn btn-primary"
                onClick={() => handleGeneratePDF(showDetail.id)}
                disabled={pdfLoading === showDetail.id}
              >
                <FiFileText size={14} /> {pdfLoading === showDetail.id ? 'Generating...' : 'Download Invoice PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>❌ Cancel Order #{cancelModal}</h2>
              <button className="modal-close" onClick={() => setCancelModal(null)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>Product stock will be automatically restored.</p>
            <div className="form-group">
              <label>Cancellation Reason</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Raison de l'annulation..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCancelModal(null)}>Back</button>
              <button className="btn btn-danger" onClick={handleCancel}>Confirm Cancellation</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Edit Order #{editModal.id}</h2>
              <button className="modal-close" onClick={() => setEditModal(null)}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Client *</label>
                <select value={editClient} onChange={e => setEditClient(e.target.value)}>
                  <option value="">-- Select a client --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Order Lines *</label>
              </div>
              {editLines.map((line, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <select value={line.product_id} onChange={e => setEditLines(l => l.map((x, idx) => idx === i ? { ...x, product_id: e.target.value } : x))}
                    style={{ padding: '0.55rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem', background: '#fff' }}>
                    <option value="">-- Product --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} — stock: {p.stock}</option>)}
                  </select>
                  <input type="number" min="1" value={line.quantity}
                    onChange={e => setEditLines(l => l.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))}
                    style={{ padding: '0.55rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem' }} placeholder="Qty" />
                  {editLines.length > 1 && <button type="button" className="btn btn-danger btn-icon" onClick={() => setEditLines(l => l.filter((_, idx) => idx !== i))}>✕</button>}
                </div>
              ))}
              <button type="button" className="btn btn-ghost" style={{ marginTop: '0.25rem', marginBottom: '1rem' }}
                onClick={() => setEditLines(l => [...l, { product_id: '', quantity: 1 }])}>
                <FiPlus /> Add a line
              </button>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRACKING MODAL */}
      {trackingModal && (
        <div className="modal-overlay" onClick={() => setTrackingModal(null)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🕐 Tracking — Order #{trackingModal.order.id}</h2>
              <button className="modal-close" onClick={() => setTrackingModal(null)}>✕</button>
            </div>

            {trackingLoading ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading tracking...</p>
            ) : (
              <>
                {/* Summary strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Client',          value: trackingModal.order.client_name || '—',                          color: '#4f46e5' },
                    { label: 'Current Status',  value: STATUS[trackingModal.summary?.current_status] || trackingModal.order.status, color: '#10b981' },
                    { label: 'Status Changes',  value: trackingModal.summary?.total_changes ?? trackingModal.history.length, color: '#f59e0b' },
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'var(--bg)', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{item.label}</p>
                      <p style={{ fontSize: '0.95rem', fontWeight: 700, color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Status progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '1.75rem' }}>
                  {STATUS_FLOW.map((s, i) => {
                    const currentIdx = STATUS_FLOW.indexOf(trackingModal.order.status);
                    const isCancelled = trackingModal.order.status === 'cancelled';
                    const isDone    = !isCancelled && i <= currentIdx;
                    const isCurrent = !isCancelled && i === currentIdx;
                    const dotColor  = isCancelled && i === 0 ? '#ef4444' : isDone ? '#4f46e5' : '#e2e8f0';
                    const lineColor = !isCancelled && i < currentIdx ? '#4f46e5' : '#e2e8f0';
                    return (
                      <React.Fragment key={s}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: dotColor,
                            border: isCurrent ? '3px solid #4f46e5' : '2px solid ' + dotColor,
                            boxShadow: isCurrent ? '0 0 0 4px rgba(79,70,229,0.15)' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', color: isDone || (isCancelled && i === 0) ? '#fff' : '#94a3b8',
                            fontWeight: 700, transition: 'all 0.2s',
                          }}>
                            {isDone || (isCancelled && i === 0) ? '✓' : i + 1}
                          </div>
                          <span style={{ fontSize: '0.65rem', color: isDone ? '#4f46e5' : 'var(--text-muted)', fontWeight: isCurrent ? 700 : 400, whiteSpace: 'nowrap' }}>
                            {STATUS[s]}
                          </span>
                        </div>
                        {i < STATUS_FLOW.length - 1 && (
                          <div style={{ flex: 1, height: 3, background: lineColor, margin: '0 4px', marginBottom: '1.1rem', borderRadius: 2, transition: 'background 0.2s' }} />
                        )}
                      </React.Fragment>
                    );
                  })}
                  {trackingModal.order.status === 'cancelled' && (
                    <div style={{ marginLeft: '0.75rem', marginBottom: '1.1rem' }}>
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                        ❌ Cancelled
                      </span>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Change History
                </h4>

                {trackingModal.history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No status changes recorded yet.
                  </div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                    {/* Vertical line */}
                    <div style={{ position: 'absolute', left: '0.6rem', top: 0, bottom: 0, width: 2, background: '#e2e8f0', borderRadius: 2 }} />

                    {trackingModal.history.map((entry, i) => {
                      const statusColors = {
                        pending:   { bg: '#fef3c7', color: '#92400e' },
                        confirmed: { bg: '#dbeafe', color: '#1e40af' },
                        shipped:   { bg: '#ede9fe', color: '#5b21b6' },
                        delivered: { bg: '#dcfce7', color: '#166534' },
                        cancelled: { bg: '#fee2e2', color: '#991b1b' },
                      };
                      const sc = statusColors[entry.new_status] || { bg: '#f1f5f9', color: '#475569' };
                      const isLast = i === trackingModal.history.length - 1;
                      return (
                        <div key={entry.id || i} style={{ position: 'relative', marginBottom: isLast ? 0 : '1rem', paddingLeft: '1rem' }}>
                          {/* Dot on the line */}
                          <div style={{
                            position: 'absolute', left: '-0.95rem', top: '0.2rem',
                            width: 12, height: 12, borderRadius: '50%',
                            background: sc.color, border: '2px solid #fff',
                            boxShadow: '0 0 0 2px ' + sc.color + '40',
                          }} />
                          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem 1rem', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {entry.old_status && (
                                  <>
                                    <span style={{ background: (statusColors[entry.old_status] || { bg: '#f1f5f9' }).bg, color: (statusColors[entry.old_status] || { color: '#475569' }).color, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600 }}>
                                      {STATUS[entry.old_status] || entry.old_status}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>→</span>
                                  </>
                                )}
                                <span style={{ background: sc.bg, color: sc.color, padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>
                                  {STATUS[entry.new_status] || entry.new_status}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {entry.changed_at ? new Date(entry.changed_at).toLocaleDateString('en-GB') + ' ' + new Date(entry.changed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </span>
                            </div>
                            {(entry.user_firstname || entry.user_lastname) && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                👤 {entry.user_firstname} {entry.user_lastname}
                                {entry.user_email && <span style={{ color: '#94a3b8' }}> · {entry.user_email}</span>}
                              </p>
                            )}
                            {entry.notes && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                                "{entry.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Order lines summary */}
                {trackingModal.lines && trackingModal.lines.length > 0 && (
                  <>
                    <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.25rem 0 0.75rem' }}>
                      Order Lines
                    </h4>
                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                      <thead>
                        <tr><th>Product</th><th>Ref</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit Price</th><th style={{ textAlign: 'right' }}>Subtotal</th></tr>
                      </thead>
                      <tbody>
                        {trackingModal.lines.map((line, i) => (
                          <tr key={i}>
                            <td><strong>{line.product_name || '—'}</strong></td>
                            <td style={{ color: 'var(--text-muted)' }}><code style={{ background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.75rem' }}>{line.reference || '—'}</code></td>
                            <td style={{ textAlign: 'right' }}>{line.quantity}</td>
                            <td style={{ textAlign: 'right' }}>{parseFloat(line.unit_price || 0).toFixed(2)} TND</td>
                            <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 600 }}>{(parseFloat(line.unit_price || 0) * parseInt(line.quantity || 0)).toFixed(2)} TND</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}

            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button className="btn btn-ghost" onClick={() => setTrackingModal(null)}>Close</button>
              <button
                className="btn btn-primary"
                onClick={() => handleGeneratePDF(trackingModal.order.id)}
                disabled={pdfLoading === trackingModal.order.id}
              >
                <FiFileText size={14} /> {pdfLoading === trackingModal.order.id ? 'Generating...' : 'Download Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}