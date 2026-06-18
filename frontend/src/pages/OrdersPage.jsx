import React, { useEffect, useState, useCallback } from 'react';
import { LuPlus, LuEye, LuCircleX, LuRefreshCw, LuFileText, LuPencil, LuClock, LuTruck, LuX, LuPackage, LuUser } from 'react-icons/lu';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import { orderService } from '../services/api';
import { generateInvoicePDF } from '../utils/generatePDF';
import { ConfirmDialog, notifySuccess, notifyError, setupToasterGlobal } from '../utils/uxHelpers';
import { useSortableTable, SortIcon, sortableThStyle } from '../hooks/useSortableTable';
import Pagination from '../components/common/Pagination';
import '../styles/pages.css';

const STATUS = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const STATUS_FLOW = ['pending', 'confirmed', 'shipped', 'delivered'];
const PAGE_SIZE = 20;

const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

export default function OrdersPage() {
  const { orders, fetchOrders, ordersLoading, ordersPagination, createOrder, cancelOrder, clients, fetchClients, products, fetchProducts } = useDataStore();
  const { user } = useAuthStore();
  const [pdfLoading, setPdfLoading] = useState(null);

  // ── Server-side filters ────────────────────────────────────────────────────
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [minAmount, setMinAmount]       = useState('');
  const [maxAmount, setMaxAmount]       = useState('');
  const [filtersOpen, setFiltersOpen]   = useState(false);
  const [page, setPage]                 = useState(1);

  // Modals
  const [showCreate, setShowCreate]   = useState(false);
  const [showDetail, setShowDetail]   = useState(null);
  const [detailLines, setDetailLines] = useState([]);   // order lines for detail modal
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editModal, setEditModal]     = useState(null); // order being edited
  const [editLines, setEditLines]     = useState([]);
  const [editClient, setEditClient]   = useState('');

  // Tracking modal
  const [trackingModal, setTrackingModal] = useState(null); // { order, history, lines, summary }
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Ship modal
  const [shipModal, setShipModal]           = useState(null); // order object
  const [shipLoading, setShipLoading]       = useState(false);
  const [shipResult, setShipResult]         = useState(null); // API response to display

  // Create form
  const [selectedClient, setSelectedClient] = useState('');
  const [lines, setLines] = useState([{ product_id: '', quantity: 1 }]);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchClients(); fetchProducts(); }, []);

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const buildParams = useCallback((p = page) => {
    const params = { page: p, limit: PAGE_SIZE };
    if (search.trim())   params.search     = search.trim();
    if (filterStatus)    params.status     = filterStatus;
    if (filterClient)    params.client_id  = filterClient;
    if (dateFrom)        params.date_from  = dateFrom;
    if (dateTo)          params.date_to    = dateTo;
    if (minAmount)       params.min_amount = minAmount;
    if (maxAmount)       params.max_amount = maxAmount;
    return params;
  }, [page, search, filterStatus, filterClient, dateFrom, dateTo, minAmount, maxAmount]);

  const load = useCallback((p = page) => fetchOrders(buildParams(p)), [buildParams, fetchOrders, page]);

  useEffect(() => { load(page); }, [page]); // reload when page changes

  const applyFilters = () => { setPage(1); fetchOrders(buildParams(1)); };
  const resetFilters = () => {
    setSearch(''); setFilterStatus(''); setFilterClient('');
    setDateFrom(''); setDateTo(''); setMinAmount(''); setMaxAmount('');
    setPage(1);
    fetchOrders({ page: 1, limit: PAGE_SIZE });
  };

  // Client-side sort on the current page (no re-fetch)
  const { sorted: sortedOrders, sortKey: oSortKey, sortDir: oSortDir, onSort: onOSort } =
    useSortableTable(orders, 'order_date', 'desc');

  const hasActiveFilters = filterStatus || filterClient || dateFrom || dateTo || minAmount || maxAmount || search;

  // Bulk selection
  const [selected, setSelected] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (selected.size === (sortedOrders?.length ?? 0)) {
      setSelected(new Set());
    } else {
      setSelected(new Set((sortedOrders ?? []).map(o => o.id)));
    }
  };

  const clearSelection = () => setSelected(new Set());

  const handleBulkAction = async (action) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    let ok = 0; let fail = 0;
    for (const id of selected) {
      try {
        if (action === 'confirm') {
          await orderService.updateStatus(id, 'confirmed');
        } else if (action === 'cancel') {
          await orderService.updateStatus(id, 'cancelled');
        }
        ok++;
      } catch { fail++; }
    }
    await load(page);
    setBulkLoading(false);
    clearSelection();
    if (ok > 0) notifySuccess(`${ok} order${ok > 1 ? 's' : ''} ${action === 'confirm' ? 'confirmed' : 'cancelled'} successfully`);
    if (fail > 0) notifyError(`${fail} order${fail > 1 ? 's' : ''} could not be updated`);
  };
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
    setCancelLoading(true);
    try {
      await cancelOrder(cancelConfirm.id, cancelConfirm.reason || 'Cancelled by user');
      notifySuccess('Order cancelled — stock restored');
      setCancelModal(null);
      setCancelReason('');
      setCancelConfirm(null);
      load(page);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Error during cancellation';
      notifyError(errMsg);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await orderService.updateStatus(id, status);
      setSuccess(`Status updated: ${STATUS[status]}`);
      load(page);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || 'Error'); }
  };

  const openDetail = async (order) => {
    setError('');
    setShowDetail(order);
    setDetailLines([]);
    setDetailLoading(true);
    try {
      const r = await orderService.getById(order.id);
      setDetailLines(r.data.lines || []);
    } catch { /* non-blocking */ }
    finally { setDetailLoading(false); }
  };

  const openEdit = async (order) => {
    setError('');
    try {
      const r = await orderService.getById(order.id);
      const { lines } = r.data;
      if (!lines) throw new Error('No lines in response');
      setEditModal(order);
      setEditClient(String(order.client_id));
      setEditLines(lines.map(l => ({ product_id: String(l.product_id), quantity: l.quantity })));
    } catch (err) {
      console.error('openEdit error:', err);
      setError(err.response?.data?.message || err.message || 'Error loading order');
    }
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
      load(page);
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
      // Log the full error so we can fix pdf generation deterministically
      console.error('PDF error:', err);
      console.error('PDF error message:', err?.message);
      console.error('PDF error response:', err?.response);
      notifyError(err?.response?.data?.message || err?.message || 'Error generating PDF');
    } finally {
      setPdfLoading(null);
    }
  };


  const handleViewTracking = async (order) => {
    setError('');
    setTrackingLoading(true);
    setTrackingModal({ order, history: [], lines: [], summary: null });
    try {
      const response = await orderService.getTracking(order.id);
      const data = response.data || {};
      setTrackingModal({
        order,
        history: data.history || [],
        lines:   data.lines   || [],
        summary: data.summary || null,
      });
    } catch (err) {
      console.error('tracking error:', err);
      setTrackingModal(null);
      notifyError('Error loading order tracking');
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleShip = async () => {
    if (!shipModal) return;
    setShipLoading(true);
    setError('');
    try {
      const response = await orderService.ship(shipModal.id, {});
      const { delivery } = response.data;
      setShipResult(delivery);
      load(page);
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Error contacting First Delivery');
    } finally {
      setShipLoading(false);
    }
  };

  const closeShipModal = () => {
    if (shipResult) {
      setSuccess(`Order #${shipModal.id} shipped via First Delivery — tracking: ${shipResult.tracking_number}`);
      setTimeout(() => setSuccess(''), 6000);
    }
    setShipModal(null);
    setShipResult(null);
    setError('');
  };

  const ht = calcHT();
  const TVA_RATE = 0.19; // matches backend constant
  const tva = ht * TVA_RATE;
  const ttc = ht + tva;
  const addLine = () => setLines(l => [...l, { product_id: '', quantity: 1 }]);

  const total = ordersPagination?.total ?? (orders?.length ?? 0);

  return (
    <div className="page">
      {/* ✨ Setup toaster global */}
      {setupToasterGlobal()}

      <div className="page-header">
        <h1>Orders <span className="count">{total}</span></h1>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setError(''); }}><LuPlus size={14} /> New Order</button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && !showCreate && !cancelModal && !editModal && !trackingModal && <div className="alert alert-error">{error}</div>}

      <div className="toolbar">
        <input
          placeholder="Search by client or order #..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyFilters()}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button
          className={`btn ${hasActiveFilters ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          Filters {hasActiveFilters && '●'}
        </button>
        <button className="btn btn-primary" onClick={applyFilters}>Search</button>
        {hasActiveFilters && (
          <button className="btn btn-ghost" onClick={resetFilters} title="Reset filters">Reset</button>
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
      {hasActiveFilters && ordersPagination && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          {ordersPagination.total} result{ordersPagination.total !== 1 ? 's' : ''} found
        </p>
      )}

      {/* ── Bulk action toolbar ── */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'linear-gradient(135deg,#eff6ff,#dbeafe)',
          border: '1.5px solid #bfdbfe', borderRadius: '10px',
          padding: '0.65rem 1rem', marginBottom: '0.75rem', flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e40af' }}>
            {selected.size} order{selected.size > 1 ? 's' : ''} selected
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => handleBulkAction('confirm')}
              disabled={bulkLoading}
              style={{
                padding: '0.4rem 0.9rem', borderRadius: '7px', border: 'none',
                background: 'linear-gradient(135deg,#10b981,#059669)',
                color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                cursor: bulkLoading ? 'not-allowed' : 'pointer',
                opacity: bulkLoading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}
            >
              {bulkLoading ? "..." : "Confirm all"}
            </button>
            <button
              onClick={() => handleBulkAction('cancel')}
              disabled={bulkLoading}
              style={{
                padding: '0.4rem 0.9rem', borderRadius: '7px', border: 'none',
                background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                cursor: bulkLoading ? 'not-allowed' : 'pointer',
                opacity: bulkLoading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}
            >
              {bulkLoading ? "..." : "Cancel all"}
            </button>
            <button
              onClick={clearSelection}
              style={{
                padding: '0.4rem 0.75rem', borderRadius: '7px',
                border: '1.5px solid #bfdbfe', background: '#fff',
                color: '#374151', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        {ordersLoading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : sortedOrders.length === 0 ? (
          <div className="empty-state"><p>No orders found</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={sortedOrders.length > 0 && selected.size === sortedOrders.length}
                    ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < sortedOrders.length; }}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: 15, height: 15 }}
                    title="Select all"
                  />
                </th>
                <th style={sortableThStyle} onClick={() => onOSort('id')}>#<SortIcon col="id" sortKey={oSortKey} sortDir={oSortDir} /></th>
                <th style={sortableThStyle} onClick={() => onOSort('client_name')}>Client<SortIcon col="client_name" sortKey={oSortKey} sortDir={oSortDir} /></th>
                <th style={sortableThStyle} onClick={() => onOSort('order_date')}>Date<SortIcon col="order_date" sortKey={oSortKey} sortDir={oSortDir} /></th>
                <th style={sortableThStyle} onClick={() => onOSort('amount_ht')}>Amount (ex. tax)<SortIcon col="amount_ht" sortKey={oSortKey} sortDir={oSortDir} /></th>
                <th>Tax</th>
                <th style={sortableThStyle} onClick={() => onOSort('amount_ttc')}>Total (inc. tax)<SortIcon col="amount_ttc" sortKey={oSortKey} sortDir={oSortDir} /></th>
                <th style={sortableThStyle} onClick={() => onOSort('status')}>Status<SortIcon col="status" sortKey={oSortKey} sortDir={oSortDir} /></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedOrders.map(o => (
                <tr key={o.id} style={{ background: selected.has(o.id) ? '#eff6ff' : undefined }}>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggleSelect(o.id)}
                      style={{ cursor: 'pointer', width: 15, height: 15 }}
                    />
                  </td>
                  <td><strong>#{o.id}</strong></td>
                  <td>{o.client_name || '—'}{o.notes?.includes('Contact:') && <span title="Portal order — has delivery info" style={{ marginLeft:'0.4rem', background:'#dcfce7', color:'#15803d', fontSize:'0.62rem', fontWeight:700, padding:'0.1rem 0.35rem', borderRadius:'4px', verticalAlign:'middle' }}>PORTAL</span>}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{o.order_date ? new Date(o.order_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td>{fmt(o.amount_ht)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{fmt(o.tva)}</td>
                  <td><strong style={{ color: 'var(--primary)' }}>{fmt(o.amount_ttc)}</strong></td>
                  <td><span className={`badge badge-${o.status}`}>{STATUS[o.status] || o.status}</span></td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-ghost btn-icon" title="View details" onClick={() => openDetail(o)}><LuEye size={14} /></button>
                      <button className="btn btn-ghost btn-icon" title="Order tracking" onClick={() => handleViewTracking(o)}><LuClock size={14} /></button>
                      <button
                        className="btn btn-primary btn-icon"
                        title="Generate invoice PDF"
                        onClick={() => handleGeneratePDF(o.id)}
                        disabled={pdfLoading === o.id}
                      >
                        {pdfLoading === o.id ? <LuRefreshCw size={14} className="spin" /> : <LuFileText size={14} />}
                      </button>
                      {(o.status === 'pending' || o.status === 'confirmed') && (
                        <button className="btn btn-warning btn-icon" title="Edit order" onClick={() => openEdit(o)}><LuPencil size={14} /></button>
                      )}
                      {o.status === 'confirmed' && (
                        <button
                          className="btn btn-icon"
                          title="Hand to First Delivery"
                          onClick={() => { setShipModal(o); setError(''); }}
                          style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          Ship
                        </button>
                      )}
                      {o.status !== 'cancelled' && o.status !== 'delivered' && (
                        <button className="btn btn-success btn-icon" title="Advance status"
                          onClick={() => { const next = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1]; if (next) handleStatusUpdate(o.id, next); }}>
                          <LuRefreshCw size={14} />
                        </button>
                      )}
                      {o.status !== 'cancelled' && (
                        <button className="btn btn-danger btn-icon" title="Cancel" onClick={() => { setCancelModal(o.id); setError(''); }}><LuCircleX size={14} /></button>
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
              <h2>New Order</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}><LuX size={15} /></button>
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
              {lines.map((line, i) => {
                const selProd = products.find(p => String(p.id) === String(line.product_id));
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      {selProd && (
                        <div style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}>
                          {selProd.image
                            ? <img src={selProd.image} alt={selProd.name} onError={e => { e.currentTarget.style.display='none'; }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            : <LuPackage size={18} style={{ color: "#cbd5e1" }} />
                          }
                        </div>
                      )}
                      <select
                        value={line.product_id}
                        onChange={e => updateLine(i, 'product_id', e.target.value)}
                        style={{ width: '100%', padding: `0.55rem 0.75rem 0.55rem ${selProd ? '2.4rem' : '0.75rem'}`, border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem', background: '#fff' }}
                      >
                        <option value="">-- Product --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} — stock: {p.stock} — {parseFloat(p.unit_price).toFixed(2)} TND</option>)}
                      </select>
                    </div>
                    <input type="number" min="1" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} style={{ padding: '0.55rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem' }} placeholder="Qty" />
                    {lines.length > 1 && <button type="button" className="btn btn-danger btn-icon" onClick={() => removeLine(i)}><LuX size={15} /></button>}
                  </div>
                );
              })}
              <button type="button" className="btn btn-ghost" style={{ marginTop: '0.25rem', marginBottom: '1rem' }} onClick={addLine}><LuPlus size={14} /> Add a line</button>

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
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Order #{showDetail.id}</h2>
              <button className="modal-close" onClick={() => setShowDetail(null)}><LuX size={15} /></button>
            </div>

            {/* Order meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {[
                ['Client',            showDetail.client_name || '—'],
                ['Sales Rep',         `${showDetail.user_firstname || ''} ${showDetail.user_lastname || ''}`.trim() || '—'],
                ['Date',              showDetail.order_date ? new Date(showDetail.order_date).toLocaleDateString('en-GB') : '—'],
                ['Status',            <span className={`badge badge-${showDetail.status}`}>{STATUS[showDetail.status]}</span>],
                ...(showDetail.delivery_company ? [['Delivery',  <span style={{ color: '#16a34a', fontWeight: 700 }}>🚚 {showDetail.delivery_company}</span>]] : []),
                ...(showDetail.tracking_number  ? [['Tracking #', <code style={{ background: '#f0fdf4', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.82rem' }}>{showDetail.tracking_number}</code>]] : []),
                ...(showDetail.cancel_reason    ? [['Cancel reason', showDetail.cancel_reason]] : []),
              ].map(([label, value], i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.6rem 0.85rem', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>{label}</p>
                  <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* ── Delivery info (from client checkout form) ── */}
            {(() => {
              const raw = showDetail.notes || '';
              if (!raw.includes('Contact:') && !raw.includes('Address:')) return null;
              // Parse pipe-separated key: value pairs
              const pairs = raw.split(' | ').reduce((acc, part) => {
                const idx = part.indexOf(': ');
                if (idx > -1) acc[part.slice(0, idx).trim()] = part.slice(idx + 2).trim();
                return acc;
              }, {});
              const fields = [
                ['Contact',  pairs['Contact']],
                ['Phone',    pairs['Phone']],
                ['Address',  pairs['Address']],
                ['Region',   pairs['Region']],
                ['Notes',    pairs['Notes']],
              ].filter(([, v]) => v);
              if (fields.length === 0) return null;
              return (
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                    Delivery Information
                  </p>
                  <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      {fields.map(([label, value]) => (
                        <div key={label} style={label === 'Notes' || label === 'Address' ? { gridColumn: '1 / -1' } : {}}>
                          <p style={{ margin: 0, fontSize: '0.68rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>{label}</p>
                          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#14532d' }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Order lines with product images */}
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>Products ordered</p>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>Loading...</div>
              ) : detailLines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.875rem' }}>No lines found</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {detailLines.map((line, i) => {
                    const prod = products.find(p => String(p.id) === String(line.product_id));
                    const subtotal = parseFloat(line.unit_price || 0) * parseInt(line.quantity || 0);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', borderRadius: '10px', padding: '0.65rem 0.85rem', border: '1px solid #e2e8f0' }}>
                        {/* Product image */}
                        <div style={{ width: 48, height: 48, borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {prod?.image
                            ? <img src={prod.image} alt={prod.name} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            : null}
                          <LuPackage size={20} style={{ color:"#cbd5e1", display: prod?.image ? "none" : "flex" }} />
                        </div>
                        {/* Name + ref */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {line.product_name || prod?.name || '—'}
                          </p>
                          <code style={{ fontSize: '0.72rem', color: '#64748b', background: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                            {line.reference || prod?.reference || '—'}
                          </code>
                        </div>
                        {/* Qty + price */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>{line.quantity} × {parseFloat(line.unit_price || 0).toFixed(2)} TND</p>
                          <p style={{ margin: 0, fontWeight: 800, color: 'var(--primary)', fontSize: '0.92rem' }}>{subtotal.toFixed(2)} TND</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Totals */}
            <div style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', borderRadius: '10px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0' }}>
              {[
                ['Subtotal (ex. tax)', fmt(showDetail.amount_ht), false],
                ['Tax (19%)',          fmt(showDetail.tva),        false],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b', marginBottom: '0.35rem' }}>
                  <span>{label}</span><span>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0', fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>
                <span>Total (inc. tax)</span>
                <span style={{ color: 'var(--primary)' }}>{fmt(showDetail.amount_ttc)}</span>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button className="btn btn-ghost" onClick={() => setShowDetail(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => handleGeneratePDF(showDetail.id)} disabled={pdfLoading === showDetail.id}>
                <LuFileText size={14} /> {pdfLoading === showDetail.id ? 'Generating...' : 'Download Invoice PDF'}
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
              <h2>Cancel Order #{cancelModal}</h2>
              <button className="modal-close" onClick={() => setCancelModal(null)}><LuX size={15} /></button>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>Product stock will be automatically restored.</p>
            <div className="form-group">
              <label>Cancellation Reason</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Raison de l'annulation..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCancelModal(null)}>Retour</button>
              <button className="btn btn-danger" onClick={() => setCancelConfirm({ id: cancelModal, reason: cancelReason })}>Confirmer l'annulation</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Order #{editModal.id}</h2>
              <button className="modal-close" onClick={() => setEditModal(null)}><LuX size={15} /></button>
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
              {editLines.map((line, i) => {
                const selProd = products.find(p => String(p.id) === String(line.product_id));
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      {selProd && (
                        <div style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}>
                          {selProd.image
                            ? <img src={selProd.image} alt={selProd.name} onError={e => { e.currentTarget.style.display='none'; }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            : <LuPackage size={18} style={{ color: "#cbd5e1" }} />
                          }
                        </div>
                      )}
                      <select
                        value={line.product_id}
                        onChange={e => setEditLines(l => l.map((x, idx) => idx === i ? { ...x, product_id: e.target.value } : x))}
                        style={{ width: '100%', padding: `0.55rem 0.75rem 0.55rem ${selProd ? '2.4rem' : '0.75rem'}`, border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem', background: '#fff' }}
                      >
                        <option value="">-- Product --</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} — stock: {p.stock} — {parseFloat(p.unit_price).toFixed(2)} TND</option>)}
                      </select>
                    </div>
                    <input type="number" min="1" value={line.quantity}
                      onChange={e => setEditLines(l => l.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))}
                      style={{ padding: '0.55rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.875rem' }} placeholder="Qty" />
                    {editLines.length > 1 && <button type="button" className="btn btn-danger btn-icon" onClick={() => setEditLines(l => l.filter((_, idx) => idx !== i))}><LuX size={15} /></button>}
                  </div>
                );
              })}
              <button type="button" className="btn btn-ghost" style={{ marginTop: '0.25rem', marginBottom: '1rem' }}
                onClick={() => setEditLines(l => [...l, { product_id: '', quantity: 1 }])}>
                <LuPlus size={14} /> Add a line
              </button>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHIP MODAL — First Delivery API Integration */}
      {shipModal && (
        <div className="modal-overlay" onClick={() => !shipLoading && closeShipModal()}>
          <div className="modal" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>

            {/* ── Phase 1: Confirm ── */}
            {!shipResult && (
              <>
                <div className="modal-header">
                  <h2>Ship via First Delivery</h2>
                  <button className="modal-close" onClick={closeShipModal} disabled={shipLoading}><LuX size={16} /></button>
                </div>

                {/* Branding */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.85rem',
                  background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                  border: '1px solid #86efac', borderRadius: '12px',
                  padding: '1rem 1.1rem', marginBottom: '1.25rem',
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '12px', flexShrink: 0,
                    background: 'linear-gradient(135deg,#16a34a,#15803d)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', boxShadow: '0 4px 12px rgba(22,163,74,0.35)',
                  }}>🚚</div>
                  <div>
                    <div style={{ fontWeight: 900, color: '#15803d', fontSize: '1rem' }}>First Delivery</div>
                    <div style={{ fontSize: '0.78rem', color: '#166534' }}>Tunisia's #1 delivery partner</div>
                  </div>
                  <div style={{ marginLeft: 'auto', background: '#16a34a', color: '#fff', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>
                    API Connected
                  </div>
                </div>

                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '1.25rem', border: '1px solid var(--border)' }}>
                  {[
                    ['Order', `#${shipModal.id}`],
                    ['Client', shipModal.client_name || '—'],
                    ['Amount', `${parseFloat(shipModal.amount_ttc || 0).toFixed(2)} TND`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                  Clicking <strong>Create Shipment</strong> will contact the First Delivery API, generate a tracking number and schedule a pickup automatically.
                </p>

                {error && <div className="alert alert-error">{error}</div>}

                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={closeShipModal} disabled={shipLoading}>Cancel</button>
                  <button
                    onClick={handleShip}
                    disabled={shipLoading}
                    style={{
                      background: shipLoading ? '#86efac' : 'linear-gradient(135deg,#16a34a,#15803d)',
                      color: '#fff', border: 'none', borderRadius: '8px',
                      padding: '0.7rem 1.4rem', fontWeight: 800, cursor: shipLoading ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                    }}
                  >
                    {shipLoading ? (
                      <>
                        <LuRefreshCw size={16} style={{ display:"inline-block", animation:"spin 1s linear infinite" }} />
                        Contacting First Delivery API...
                      </>
                    ) : '🚚 Create Shipment'}
                  </button>
                </div>
              </>
            )}

            {/* ── Phase 2: API Response ── */}
            {shipResult && (
              <>
                <div className="modal-header">
                  <h2>Shipment Created</h2>
                  <button className="modal-close" onClick={closeShipModal}><LuX size={16} /></button>
                </div>

                {/* Success banner */}
                <div style={{
                  background: 'linear-gradient(135deg,#16a34a,#15803d)',
                  borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.25rem',
                  display: 'flex', alignItems: 'center', gap: '0.85rem',
                  boxShadow: '0 4px 16px rgba(22,163,74,0.3)',
                }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center" }}><LuPackage size={22} /></div>
                  <div>
                    <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.95rem' }}>
                      {shipResult.message}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', marginTop: '0.2rem' }}>
                      Shipment ID: {shipResult.shipment_id}
                    </div>
                  </div>
                </div>

                {/* API response details */}
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border)', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    First Delivery API Response
                  </div>

                  {/* Tracking number — highlighted */}
                  <div style={{ background: '#fff', border: '2px solid #16a34a', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>TRACKING NUMBER</div>
                      <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#15803d', letterSpacing: '0.05em' }}>{shipResult.tracking_number}</div>
                    </div>
                    <button
                      onClick={() => navigator.clipboard?.writeText(shipResult.tracking_number)}
                      style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.75rem', color: '#15803d', fontWeight: 700 }}
                      title="Copy tracking number"
                    >
                      Copy
                    </button>
                  </div>

                  {[
                    ['Provider',           shipResult.provider],
                    ['Status',             shipResult.status],
                    ['Estimated Delivery', new Date(shipResult.estimated_delivery).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
                    ['Pickup Scheduled',   new Date(shipResult.pickup_scheduled).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' today'],
                    ['Delivery Fee',       `${shipResult.delivery_fee} TND`],
                    ['Recipient',          `${shipResult.recipient.name} — ${shipResult.recipient.region}`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.83rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
                      <span style={{ fontWeight: 700, color: label === 'Status' ? '#16a34a' : 'var(--text)' }}>{value}</span>
                    </div>
                  ))}
                </div>

                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={closeShipModal}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* TRACKING MODAL */}
      {trackingModal && (
        <div className="modal-overlay" onClick={() => setTrackingModal(null)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Tracking — Order #{trackingModal.order.id}</h2>
              <button className="modal-close" onClick={() => setTrackingModal(null)}><LuX size={15} /></button>
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
                    { label: 'Status Changes',  value: trackingModal.summary?.total_changes ?? (trackingModal.history || []).length, color: '#f59e0b' },
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
                        Cancelled
                      </span>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Change History
                </h4>

                {(trackingModal.history || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No status changes recorded yet.
                  </div>
                ) : (
                  <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                    {/* Vertical line */}
                    <div style={{ position: 'absolute', left: '0.6rem', top: 0, bottom: 0, width: 2, background: '#e2e8f0', borderRadius: 2 }} />

                    {(trackingModal.history || []).map((entry, i) => {
                      const statusColors = {
                        pending:   { bg: '#fef3c7', color: '#92400e' },
                        confirmed: { bg: '#dbeafe', color: '#1e40af' },
                        shipped:   { bg: '#ede9fe', color: '#5b21b6' },
                        delivered: { bg: '#dcfce7', color: '#166534' },
                        cancelled: { bg: '#fee2e2', color: '#991b1b' },
                      };
                      const sc = statusColors[entry.new_status] || { bg: '#f1f5f9', color: '#475569' };
                      const isLast = i === (trackingModal.history || []).length - 1;
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
                                {entry.user_firstname} {entry.user_lastname}
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
                {(trackingModal.lines || []).length > 0 && (trackingModal.lines || []).length > 0 && (
                  <>
                    <h4 style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.25rem 0 0.75rem' }}>
                      Order Lines
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(trackingModal.lines || []).map((line, i) => {
                        const prod = products.find(p => String(p.id) === String(line.product_id));
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', borderRadius: '10px', padding: '0.65rem 0.85rem', border: '1px solid #e2e8f0' }}>
                            {/* Product thumbnail */}
                            <div style={{ width: 44, height: 44, borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {prod?.image
                                ? <img src={prod.image} alt={prod.name} onError={e => { e.currentTarget.style.display='none'; }} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                : <span style={{ fontSize: '1.2rem' }}>📦</span>
                              }
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.product_name || '—'}</p>
                              <code style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{line.reference || '—'}</code>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>{line.quantity} × {parseFloat(line.unit_price || 0).toFixed(2)} TND</p>
                              <p style={{ margin: 0, fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>{(parseFloat(line.unit_price || 0) * parseInt(line.quantity || 0)).toFixed(2)} TND</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                <LuFileText size={14} /> {pdfLoading === trackingModal.order.id ? 'Generating...' : 'Download Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}