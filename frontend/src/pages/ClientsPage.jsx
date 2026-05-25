import React, { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiClock, FiArchive, FiRefreshCw, FiKey } from 'react-icons/fi';
import { useDataStore } from '../stores/dataStore';
import { clientService } from '../services/api';
import { clientPortalAdminService } from '../services/clientApi';
import '../styles/pages.css';

const EMPTY = { company_name: '', address: '', region: '', email: '', phone: '', segment: 'PME', status: 'active' };
const SEGMENTS = ['TPE', 'PME', 'Grande entreprise'];
const REGIONS = ['Tunis', 'Sfax', 'Sousse', 'Bizerte', 'Nabeul', 'Monastir', 'Gabès', 'Gafsa', 'Autre'];

export default function ClientsPage() {
  const {
    clients, fetchClients, clientsLoading,
    createClient, updateClient, deleteClient,
    archiveClient, restoreClient,
  } = useDataStore();

  const [search, setSearch]           = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterStatus, setFilterStatus] = useState('active'); // default: hide archived
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(EMPTY);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [historyModal, setHistoryModal] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Portal access modal
  const [portalModal, setPortalModal]   = useState(null); // client object
  const [portalPassword, setPortalPassword] = useState('');
  const [portalLoading, setPortalLoading]   = useState(false);
  const [showPortalPassword, setShowPortalPassword] = useState(false);

  useEffect(() => { fetchClients(); }, []);

  const filtered = clients.filter(c => {
    const matchSearch  = c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
                         c.email?.toLowerCase().includes(search.toLowerCase());
    const matchRegion  = !filterRegion || c.region === filterRegion;
    const matchStatus  = !filterStatus || c.status === filterStatus;
    return matchSearch && matchRegion && matchStatus;
  });

  const archivedCount = clients.filter(c => c.status === 'archived').length;

  const openCreate  = () => { setForm(EMPTY); setEditing(null); setError(''); setShowModal(true); };
  const openEdit    = (c) => {
    setForm({
      company_name: c.company_name || '',
      address:      c.address      || '',
      region:       c.region       || '',
      email:        c.email        || '',
      phone:        c.phone        || '',
      segment:      c.segment      || 'PME',
      status:       c.status       || 'active',
    });
    setEditing(c.id);
    setError('');
    setShowModal(true);
  };
  const closeModal  = () => { setShowModal(false); setError(''); };
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.company_name) { setError('Company name is required'); return; }
    try {
      if (editing) { await updateClient(editing, form); setSuccess('Client updated'); }
      else         { await createClient(form);          setSuccess('Client created'); }
      closeModal();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Server error'); }
  };

  const handleArchive = async (id, name) => {
    if (!window.confirm(`Archive "${name}"?\nThe client will be hidden but their data and orders will be preserved.`)) return;
    try {
      await archiveClient(id);
      setSuccess('Client archived');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Error during archiving'); }
  };

  const handleRestore = async (id, name) => {
    try {
      await restoreClient(id);
      setSuccess(`"${name}" restored successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Error during restoration'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Permanently delete "${name}"?\nThis action is irreversible.`)) return;
    try {
      await deleteClient(id);
      setSuccess('Client permanently deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Error during deletion'); }
  };

  const handleViewHistory = async (client) => {
    setHistoryLoading(true);
    setHistoryModal({ client, orders: [] });
    try {
      const r = await clientService.getOrders(client.id);
      setHistoryModal({ client, orders: r.data });
    } catch {
      setHistoryModal({ client, orders: [] });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSetPortalAccess = async () => {
    if (!portalPassword || portalPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setPortalLoading(true);
    setError('');
    try {
      await clientPortalAdminService.setPassword(portalModal.id, portalPassword);
      setSuccess(`Portal access enabled for "${portalModal.company_name}"`);
      setPortalModal(null);
      setPortalPassword('');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error enabling portal access');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleDisablePortal = async (client) => {
    if (!window.confirm(`Disable portal access for "${client.company_name}"?`)) return;
    try {
      await clientPortalAdminService.disablePortal(client.id);
      setSuccess(`Portal access disabled for "${client.company_name}"`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error disabling portal access');
    }
  };

  const statusLabel = { active: 'Active', inactive: 'Inactive', archived: 'Archived' };
  const statusBadge = { active: 'badge-active', inactive: 'badge-inactive', archived: 'badge-cancelled' };

  return (
    <div className="page">
      <div className="page-header">
        <h1>👥 Clients <span className="count">{clients.filter(c => c.status !== 'archived').length}</span></h1>
        <button className="btn btn-primary" onClick={openCreate}><FiPlus /> New Client</button>
      </div>

      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && !showModal && <div className="alert alert-error">⚠ {error}</div>}

      <div className="toolbar">
        <input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
          <option value="">All regions</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="archived">Archived {archivedCount > 0 ? `(${archivedCount})` : ''}</option>
        </select>
      </div>

      {/* Archived banner */}
      {filterStatus === 'archived' && archivedCount > 0 && (
        <div style={{
          background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px',
          padding: '0.65rem 1rem', marginBottom: '0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#92400e',
        }}>
          <FiArchive size={14} />
          <span>You are viewing archived clients. Click <strong>Restore</strong> to reactivate them.</span>
        </div>
      )}

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <p>{filterStatus === 'archived' ? 'No archived clients' : 'No clients found'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Company Name</th>
                <th>Region</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Segment</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} style={{ opacity: c.status === 'archived' ? 0.65 : 1 }}>
                  <td style={{ color: 'var(--text-muted)' }}>{c.id}</td>
                  <td>
                    <strong>{c.company_name}</strong>
                    {c.status === 'archived' && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#92400e', background: '#fef3c7', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                        archived
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.region || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.email || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.phone || '—'}</td>
                  <td><span className="badge badge-shipped">{c.segment || '—'}</span></td>
                  <td>
                    <span className={`badge ${statusBadge[c.status] || 'badge-inactive'}`}>
                      {statusLabel[c.status] || c.status}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      {c.status !== 'archived' && (
                        <button
                          className="btn btn-ghost btn-icon"
                          title="Order history"
                          onClick={() => handleViewHistory(c)}
                        >
                          <FiClock size={14} />
                        </button>
                      )}
                      {c.status !== 'archived' && (
                        <button
                          className="btn btn-ghost btn-icon"
                          title="Set portal access / password"
                          onClick={() => { setPortalModal(c); setPortalPassword(''); setError(''); setShowPortalPassword(false); }}
                          style={{ color: '#4f46e5' }}
                        >
                          <FiKey size={14} />
                        </button>
                      )}
                      {c.status !== 'archived' && (
                        <button
                          className="btn btn-warning btn-icon"
                          title="Edit"
                          onClick={() => openEdit(c)}
                        >
                          <FiEdit2 size={14} />
                        </button>
                      )}
                      {c.status !== 'archived' ? (
                        <button
                          className="btn btn-ghost btn-icon"
                          title="Archive this client"
                          onClick={() => handleArchive(c.id, c.company_name)}
                          style={{ color: '#92400e' }}
                        >
                          <FiArchive size={14} />
                        </button>
                      ) : (
                        <button
                          className="btn btn-ghost btn-icon"
                          title="Restore this client"
                          onClick={() => handleRestore(c.id, c.company_name)}
                          style={{ color: '#16a34a' }}
                        >
                          <FiRefreshCw size={14} />
                        </button>
                      )}
                      {c.status === 'archived' && (
                        <button
                          className="btn btn-danger btn-icon"
                          title="Delete permanently"
                          onClick={() => handleDelete(c.id, c.company_name)}
                        >
                          <FiTrash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? '✏️ Edit Client' : '➕ New Client'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Company Name *</label>
                <input name="company_name" value={form.company_name} onChange={handleChange} placeholder="Company name" />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input name="address" value={form.address} onChange={handleChange} placeholder="Full address" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Region</label>
                  <select name="region" value={form.region} onChange={handleChange}>
                    <option value="">-- Select --</option>
                    {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Segment</label>
                  <select name="segment" value={form.segment} onChange={handleChange}>
                    {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="contact@company.com" />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+216 XX XXX XXX" />
                </div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={clientsLoading}>
                  {clientsLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {historyModal && (
        <div className="modal-overlay" onClick={() => setHistoryModal(null)}>
          <div className="modal" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 History — {historyModal.client.company_name}</h2>
              <button className="modal-close" onClick={() => setHistoryModal(null)}>✕</button>
            </div>

            {historyLoading ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</p>
            ) : historyModal.orders.length === 0 ? (
              <div className="empty-state"><p>No orders for this client</p></div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {[
                    { label: 'Total Orders', value: historyModal.orders.length, color: '#4f46e5' },
                    {
                      label: 'Total Revenue (inc. tax)',
                      value: historyModal.orders
                        .filter(o => o.status !== 'cancelled')
                        .reduce((s, o) => s + parseFloat(o.amount_ttc || 0), 0)
                        .toLocaleString('en-GB', { maximumFractionDigits: 0 }) + ' TND',
                      color: '#10b981',
                    },
                    {
                      label: 'Last Order',
                      value: new Date(historyModal.orders[0].order_date).toLocaleDateString('en-GB'),
                      color: '#f59e0b',
                    },
                  ].map((item, i) => (
                    <div key={i} style={{ background: 'var(--bg)', borderRadius: '10px', padding: '0.85rem 1rem', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.3rem' }}>{item.label}</p>
                      <p style={{ fontSize: '1.1rem', fontWeight: 700, color: item.color }}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>#</th><th>Date</th><th>Amount (ex. tax)</th><th>Tax</th><th>Total (inc. tax)</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {historyModal.orders.map(o => (
                      <tr key={o.id}>
                        <td><strong>#{o.id}</strong></td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{new Date(o.order_date).toLocaleDateString('en-GB')}</td>
                        <td>{parseFloat(o.amount_ht).toFixed(2)} TND</td>
                        <td style={{ color: 'var(--text-muted)' }}>{parseFloat(o.tva).toFixed(2)} TND</td>
                        <td><strong style={{ color: 'var(--primary)' }}>{parseFloat(o.amount_ttc).toFixed(2)} TND</strong></td>
                        <td>
                          <span className={`badge badge-${o.status}`}>
                            {{ pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' }[o.status] || o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setHistoryModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* PORTAL ACCESS MODAL */}
      {portalModal && (
        <div className="modal-overlay" onClick={() => setPortalModal(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔑 Portal Access — {portalModal.company_name}</h2>
              <button className="modal-close" onClick={() => setPortalModal(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Set a password to allow <strong>{portalModal.company_name}</strong> to log in at{' '}
              <code style={{ background: '#f1f5f9', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>/client/login</code>{' '}
              and place orders directly.
            </p>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label>Portal Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPortalPassword ? 'text' : 'password'}
                  value={portalPassword}
                  onChange={e => setPortalPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  autoComplete="new-password"
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPortalPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9ca3af', fontSize: '1rem', padding: 0, lineHeight: 1,
                  }}
                  title={showPortalPassword ? 'Hide password' : 'Show password'}
                >
                  {showPortalPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Login email: <strong>{portalModal.email || '(no email set)'}</strong>
              </small>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setPortalModal(null); setError(''); setShowPortalPassword(false); }}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleSetPortalAccess}
                disabled={portalLoading || !portalModal.email}
              >
                {portalLoading ? 'Saving...' : '✓ Enable Portal Access'}
              </button>
            </div>
            {!portalModal.email && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.5rem' }}>
                ⚠ This client has no email address. Add one first before enabling portal access.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
