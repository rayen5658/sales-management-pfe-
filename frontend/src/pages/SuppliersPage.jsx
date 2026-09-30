import React, { useEffect, useState } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuTruck } from 'react-icons/lu';
import { supplierService } from '../services/api';
import { notifySuccess, notifyError, setupToasterGlobal } from '../utils/uxHelpers';
import { useSortableTable, SortIcon, sortableThStyle } from '../hooks/useSortableTable';
import '../styles/pages.css';

const EMPTY = { name: '', contact_name: '', email: '', phone: '', address: '', status: 'active' };

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    supplierService.getAll()
      .then(r => setSuppliers(r.data))
      .catch(err => setError(err.response?.status === 403 ? 'Access reserved for Administrators and Managers.' : 'Error loading suppliers.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const { sorted, sortKey, sortDir, onSort } = useSortableTable(filtered, 'name', 'asc');

  const openCreate = () => { setForm(EMPTY); setEditing(null); setFormError(''); setShowModal(true); };
  const openEdit = (s) => {
    setForm({ name: s.name || '', contact_name: s.contact_name || '', email: s.email || '', phone: s.phone || '', address: s.address || '', status: s.status || 'active' });
    setEditing(s.id); setFormError(''); setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setFormError(''); };
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Supplier name is required'); return; }
    setSaving(true);
    try {
      if (editing) { await supplierService.update(editing, form); notifySuccess('Supplier updated'); }
      else { await supplierService.create(form); notifySuccess('Supplier created'); }
      closeModal();
      load();
    } catch (err) { setFormError(err.response?.data?.message || 'Server error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete supplier "${s.name}"?`)) return;
    try {
      await supplierService.delete(s.id);
      notifySuccess('Supplier deleted');
      load();
    } catch (err) { notifyError(err.response?.data?.message || 'Could not delete this supplier'); }
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>;
  if (error) return <div className="page"><div className="alert alert-error">⚠ {error}</div></div>;

  return (
    <div className="page">
      {setupToasterGlobal()}
      <div className="page-header">
        <h1><LuTruck size={20} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />Suppliers <span className="count">{suppliers.length}</span></h1>
        <button className="btn btn-primary" onClick={openCreate}><LuPlus size={14} /> New Supplier</button>
      </div>

      <div className="toolbar">
        <input placeholder="Search by name, contact or email..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        {sorted.length === 0 ? (
          <div className="empty-state"><p>No suppliers found</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={sortableThStyle} onClick={() => onSort('name')}>Name<SortIcon col="name" sortKey={sortKey} sortDir={sortDir} /></th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th style={sortableThStyle} onClick={() => onSort('status')}>Status<SortIcon col="status" sortKey={sortKey} sortDir={sortDir} /></th>
                <th>Purchase Orders</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.contact_name || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.email || '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{s.phone || '—'}</td>
                  <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                  <td>{s.purchase_order_count}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-warning btn-icon" title="Edit" onClick={() => openEdit(s)}><LuPencil size={14} /></button>
                      <button className="btn btn-danger btn-icon" title="Delete" onClick={() => handleDelete(s)}><LuTrash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            {formError && <div className="alert alert-error">{formError}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Name *</label><input name="name" value={form.name} onChange={handleChange} placeholder="Supplier company name" /></div>
              <div className="form-row">
                <div className="form-group"><label>Contact Name</label><input name="contact_name" value={form.contact_name} onChange={handleChange} placeholder="Contact person" /></div>
                <div className="form-group"><label>Phone</label><input name="phone" value={form.phone} onChange={handleChange} placeholder="+216 ..." /></div>
              </div>
              <div className="form-group"><label>Email</label><input type="email" name="email" value={form.email} onChange={handleChange} placeholder="supplier@company.com" /></div>
              <div className="form-group"><label>Address</label><textarea name="address" value={form.address} onChange={handleChange} placeholder="Street, city..." rows={2} /></div>
              <div className="form-group">
                <label>Status</label>
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
