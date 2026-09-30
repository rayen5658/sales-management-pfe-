import React, { useEffect, useState } from 'react';
import { LuPlus, LuX, LuPackageCheck, LuCircleX, LuTrash2, LuEye, LuClipboardList } from 'react-icons/lu';
import { purchaseOrderService, supplierService, productService } from '../services/api';
import { notifySuccess, notifyError, setupToasterGlobal } from '../utils/uxHelpers';
import { useSortableTable, SortIcon, sortableThStyle } from '../hooks/useSortableTable';
import '../styles/pages.css';

const STATUS = { pending: 'Draft', ordered: 'Ordered', received: 'Received', cancelled: 'Cancelled' };
const STATUS_FLOW = ['pending', 'ordered', 'received'];
const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ product_id: '', quantity: 1, unit_cost: '' }]);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = () => {
    const params = filterStatus ? { status: filterStatus } : {};
    purchaseOrderService.getAll(params)
      .then(r => setOrders(r.data.data))
      .catch(err => setError(err.response?.status === 403 ? 'Access reserved for Administrators and Managers.' : 'Error loading purchase orders.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus]);
  useEffect(() => {
    supplierService.getAll().then(r => setSuppliers(r.data)).catch(() => {});
    productService.getAll().then(r => setProducts(r.data)).catch(() => {});
  }, []);

  const { sorted, sortKey, sortDir, onSort } = useSortableTable(orders, 'order_date', 'desc');

  // ── Create modal ──
  const openCreate = () => {
    setSelectedSupplier(''); setExpectedDelivery(''); setNotes('');
    setLines([{ product_id: '', quantity: 1, unit_cost: '' }]);
    setCreateError(''); setShowCreate(true);
  };
  const addLine = () => setLines(l => [...l, { product_id: '', quantity: 1, unit_cost: '' }]);
  const removeLine = (i) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i, field, value) => setLines(l => l.map((line, idx) => {
    if (idx !== i) return line;
    const updated = { ...line, [field]: value };
    if (field === 'product_id' && !line.unit_cost) {
      const p = products.find(p => String(p.id) === String(value));
      if (p) updated.unit_cost = p.unit_price;
    }
    return updated;
  }));

  const lineTotal = (l) => (parseFloat(l.unit_cost) || 0) * (parseInt(l.quantity) || 0);
  const orderTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!selectedSupplier) { setCreateError('Select a supplier'); return; }
    const validLines = lines.filter(l => l.product_id && l.quantity > 0 && l.unit_cost !== '');
    if (validLines.length === 0) { setCreateError('Add at least one item with a product, quantity and unit cost'); return; }

    setCreating(true);
    try {
      await purchaseOrderService.create({
        supplier_id: parseInt(selectedSupplier),
        items: validLines.map(l => ({ product_id: parseInt(l.product_id), quantity: parseInt(l.quantity), unit_cost: parseFloat(l.unit_cost) })),
        expected_delivery: expectedDelivery || undefined,
        notes: notes || undefined,
      });
      notifySuccess('Purchase order created');
      setShowCreate(false);
      load();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Server error');
    } finally {
      setCreating(false);
    }
  };

  // ── Detail ──
  const openDetail = async (o) => {
    setDetailLoading(true);
    setDetail({ order: o, lines: [] });
    try {
      const r = await purchaseOrderService.getById(o.id);
      setDetail(r.data);
    } catch { notifyError('Error loading purchase order details'); setDetail(null); }
    finally { setDetailLoading(false); }
  };

  // ── Actions ──
  const handleAdvance = async (o) => {
    const next = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1];
    if (!next) return;
    if (next === 'received' && !window.confirm(`Mark purchase order #${o.id} as received? This will add its items back into stock immediately.`)) return;
    try {
      await purchaseOrderService.updateStatus(o.id, next);
      notifySuccess(next === 'received' ? `Received — stock updated` : `Marked as ${STATUS[next]}`);
      load();
    } catch (err) { notifyError(err.response?.data?.message || 'Could not update status'); }
  };

  const handleCancel = async () => {
    if (!cancelModal) return;
    setCancelLoading(true);
    try {
      await purchaseOrderService.cancel(cancelModal, cancelReason || undefined);
      notifySuccess('Purchase order cancelled');
      setCancelModal(null); setCancelReason('');
      load();
    } catch (err) { notifyError(err.response?.data?.message || 'Could not cancel'); }
    finally { setCancelLoading(false); }
  };

  const handleDelete = async (o) => {
    if (!window.confirm(`Delete draft purchase order #${o.id}?`)) return;
    try {
      await purchaseOrderService.delete(o.id);
      notifySuccess('Purchase order deleted');
      load();
    } catch (err) { notifyError(err.response?.data?.message || 'Could not delete'); }
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>;
  if (error) return <div className="page"><div className="alert alert-error">⚠ {error}</div></div>;

  return (
    <div className="page">
      {setupToasterGlobal()}
      <div className="page-header">
        <h1><LuClipboardList size={20} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />Purchase Orders <span className="count">{orders.length}</span></h1>
        <button className="btn btn-primary" onClick={openCreate}><LuPlus size={14} /> New Purchase Order</button>
      </div>

      <div className="toolbar">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Draft</option>
          <option value="ordered">Ordered</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="table-wrap">
        {sorted.length === 0 ? (
          <div className="empty-state"><p>No purchase orders {filterStatus ? `with status "${STATUS[filterStatus]}"` : 'yet'}</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={sortableThStyle} onClick={() => onSort('id')}>#<SortIcon col="id" sortKey={sortKey} sortDir={sortDir} /></th>
                <th>Supplier</th>
                <th style={sortableThStyle} onClick={() => onSort('order_date')}>Date<SortIcon col="order_date" sortKey={sortKey} sortDir={sortDir} /></th>
                <th style={sortableThStyle} onClick={() => onSort('amount_ttc')}>Total (inc. tax)<SortIcon col="amount_ttc" sortKey={sortKey} sortDir={sortDir} /></th>
                <th style={sortableThStyle} onClick={() => onSort('status')}>Status<SortIcon col="status" sortKey={sortKey} sortDir={sortDir} /></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(o => (
                <tr key={o.id}>
                  <td><strong>#{o.id}</strong></td>
                  <td>{o.supplier_name || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{o.order_date ? new Date(o.order_date).toLocaleDateString('en-GB') : '—'}</td>
                  <td><strong style={{ color: 'var(--primary)' }}>{fmt(o.amount_ttc)}</strong></td>
                  <td><span className={`badge badge-${o.status === 'received' ? 'confirmed' : o.status === 'cancelled' ? 'cancelled' : 'pending'}`}>{STATUS[o.status]}</span></td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-ghost btn-icon" title="View details" onClick={() => openDetail(o)}><LuEye size={14} /></button>
                      {o.status !== 'cancelled' && o.status !== 'received' && (
                        <button className="btn btn-success btn-icon" title={o.status === 'ordered' ? 'Mark as received (updates stock)' : 'Mark as ordered'} onClick={() => handleAdvance(o)}>
                          <LuPackageCheck size={14} />
                        </button>
                      )}
                      {o.status === 'pending' && (
                        <button className="btn btn-danger btn-icon" title="Delete draft" onClick={() => handleDelete(o)}><LuTrash2 size={14} /></button>
                      )}
                      {(o.status === 'pending' || o.status === 'ordered') && (
                        <button className="btn btn-danger btn-icon" title="Cancel" onClick={() => { setCancelModal(o.id); setCancelReason(''); }}><LuCircleX size={14} /></button>
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
          <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Purchase Order</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}><LuX size={15} /></button>
            </div>
            {createError && <div className="alert alert-error">{createError}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group">
                  <label>Supplier *</label>
                  <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                    <option value="">-- Select a supplier --</option>
                    {suppliers.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Expected Delivery</label>
                  <input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} />
                </div>
              </div>

              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.5rem' }}>Items *</label>
              {lines.map((line, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px auto', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <select value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)} style={{ padding: '0.5rem 0.65rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem', background: 'var(--card-bg)', color: 'var(--text)' }}>
                    <option value="">-- Product --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" min="1" placeholder="Qty" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} style={{ padding: '0.5rem 0.65rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem' }} />
                  <input type="number" min="0" step="0.01" placeholder="Unit cost" value={line.unit_cost} onChange={e => updateLine(i, 'unit_cost', e.target.value)} style={{ padding: '0.5rem 0.65rem', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '0.85rem' }} />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeLine(i)} disabled={lines.length === 1} title="Remove line"><LuX size={14} /></button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem', marginBottom: '1rem' }} onClick={addLine}><LuPlus size={13} /> Add item</button>

              <div className="form-group"><label>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes for this order..." /></div>

              <div style={{ background: 'var(--card-bg-2)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Estimated total (ex. tax)</span>
                <span style={{ color: 'var(--primary)' }}>{fmt(orderTotal)}</span>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create purchase order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Purchase Order #{detail.order.id}</h2>
              <button className="modal-close" onClick={() => setDetail(null)}><LuX size={15} /></button>
            </div>
            {detailLoading ? <p style={{ textAlign: 'center', color: 'var(--text-faint)', padding: '2rem' }}>Loading...</p> : (
              <>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Supplier: <strong style={{ color: 'var(--text)' }}>{detail.order.supplier_name}</strong>
                  {detail.order.supplier_email && ` · ${detail.order.supplier_email}`}
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '1rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Product', 'Qty', 'Unit Cost', 'Subtotal'].map(h => <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: h === 'Product' ? 'left' : 'right', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--card-bg-2)' }}>
                        <td style={{ padding: '0.5rem' }}>{l.product_name}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{l.quantity}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(l.unit_cost)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{fmt(l.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', marginBottom: '0.5rem' }}>
                  <span>Total (inc. tax)</span><span style={{ color: 'var(--primary)' }}>{fmt(detail.order.amount_ttc)}</span>
                </div>
                {detail.order.notes && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>"{detail.order.notes}"</p>}
                {detail.order.cancel_reason && <p style={{ fontSize: '0.8rem', color: 'var(--danger-text)' }}>Cancelled: {detail.order.cancel_reason}</p>}
              </>
            )}
            <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button></div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModal && (
        <div className="modal-overlay" onClick={() => setCancelModal(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cancel Purchase Order #{cancelModal}</h2>
              <button className="modal-close" onClick={() => setCancelModal(null)}><LuX size={15} /></button>
            </div>
            <div className="form-group">
              <label>Reason (optional)</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Why is this order being cancelled?" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setCancelModal(null)}>Back</button>
              <button className="btn btn-danger" disabled={cancelLoading} onClick={handleCancel}>{cancelLoading ? 'Cancelling…' : 'Confirm cancellation'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
