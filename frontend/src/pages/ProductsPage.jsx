import React, { useEffect, useState, useRef } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiDownload, FiUpload } from 'react-icons/fi';
import { useDataStore } from '../stores/dataStore';
import { productService } from '../services/api';
import '../styles/pages.css';

const EMPTY = { name: '', reference: '', description: '', unit_price: '', stock: '', category_id: '', image: '' };

// Export products to CSV
function exportToCSV(products, categories) {
  const getCatName = (id) => categories.find(c => c.id === id)?.name || '';
  const headers = ['ID', 'Reference', 'Name', 'Description', 'Unit Price (TND)', 'Stock', 'Category'];
  const rows = products.map(p => [
    p.id,
    p.reference || '',
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.description || '').replace(/"/g, '""')}"`,
    parseFloat(p.unit_price || 0).toFixed(2),
    p.stock,
    getCatName(p.category_id),
  ]);
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `products_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ProductsPage() {
  const {
    products, fetchProducts, productsLoading,
    createProduct, updateProduct, deleteProduct,
    categories, fetchCategories,
  } = useDataStore();

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // CSV import state
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null); // { message, inserted, updated, errors }
  const [showImportModal, setShowImportModal] = useState(false);
  const csvInputRef = useRef(null);

  useEffect(() => { fetchProducts(); fetchCategories(); }, []);

  const filtered = products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.reference?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || String(p.category_id) === filterCat;
    const matchStock = !filterStock || (filterStock === 'low' && parseInt(p.stock) <= 5) || (filterStock === 'ok' && parseInt(p.stock) > 5);
    return matchSearch && matchCat && matchStock;
  });

  const lowStockCount = products.filter(p => parseInt(p.stock) <= 5).length;

  const openCreate = () => { setForm(EMPTY); setEditing(null); setError(''); setShowModal(true); };
  const openEdit = (p) => { setForm({ name: p.name || '', reference: p.reference || '', description: p.description || '', unit_price: p.unit_price || '', stock: p.stock || '', category_id: p.category_id || '', image: p.image || '' }); setEditing(p.id); setError(''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setError(''); };
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.unit_price || form.stock === '') { setError('Name, price and stock are required'); return; }
    try {
      if (editing) { await updateProduct(editing, form); setSuccess('Product updated'); }
      else { await createProduct(form); setSuccess('Product created'); }
      closeModal();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || err.response?.data?.message || 'Server error'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { await deleteProduct(id); setSuccess('Product deleted'); setTimeout(() => setSuccess(''), 3000); }
    catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('foreign key') || msg.includes('violates') || err.response?.status === 500) {
        setError(`Cannot delete "${name}" — this product is linked to existing orders.`);
      } else {
        setError(msg || 'Error during deletion');
      }
    }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await productService.importCSV(file);
      setImportResult(res.data);
      setShowImportModal(true);
      fetchProducts(); // refresh list
    } catch (err) {
      setImportResult({ message: err.response?.data?.error || 'Error during import', inserted: 0, updated: 0, errors: [] });
      setShowImportModal(true);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>📦 Products <span className="count">{products.length}</span></h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {lowStockCount > 0 && (
            <button
              className={`btn ${filterStock === 'low' ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => setFilterStock(filterStock === 'low' ? '' : 'low')}
              title="Show only out-of-stock products"
            >
              ⚠ {lowStockCount} out of stock
            </button>
          )}
          {/* Hidden CSV file input */}
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleCSVImport}
          />
          <button
            className="btn btn-ghost"
            onClick={() => csvInputRef.current?.click()}
            disabled={importLoading}
            title="Import products from a CSV file"
          >
            <FiUpload size={14} /> {importLoading ? 'Import...' : 'Import CSV'}
          </button>
          <button className="btn btn-ghost" onClick={() => exportToCSV(products, categories)} title="Export to CSV">
            <FiDownload size={14} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openCreate}><FiPlus /> New Product</button>
        </div>
      </div>

      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && !showModal && <div className="alert alert-error">⚠ {error}</div>}

      <div className="toolbar">
        <input placeholder="Search by name or reference..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <select value={filterStock} onChange={e => setFilterStock(e.target.value)}>
          <option value="">All stock levels</option>
          <option value="low">⚠ Low stock (≤ 5)</option>
          <option value="ok">✅ In stock (&gt; 5)</option>
        </select>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No products found</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Reference</th><th>Name</th><th>Unit Price</th><th>Stock</th><th>Category</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{p.id}</td>
                  <td><code style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>{p.reference || '—'}</code></td>
                  <td><strong>{p.name}</strong>{p.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{p.description.substring(0, 50)}{p.description.length > 50 ? '...' : ''}</p>}</td>
                  <td><strong>{parseFloat(p.unit_price || 0).toFixed(2)} TND</strong></td>
                  <td><span className={`badge ${parseInt(p.stock) <= 5 ? 'badge-cancelled' : 'badge-active'}`}>{p.stock} units</span></td>
                  <td style={{ color: 'var(--text-muted)' }}>{categories.find(c => c.id === p.category_id)?.name || '—'}</td>
                  <td>
                    <div className="actions">
                      <button className="btn btn-warning btn-icon" title="Edit" onClick={() => openEdit(p)}><FiEdit2 size={14} /></button>
                      <button className="btn btn-danger btn-icon" title="Delete" onClick={() => handleDelete(p.id, p.name)}><FiTrash2 size={14} /></button>
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
              <h2>{editing ? '✏️ Edit Product' : '➕ New Product'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Name *</label><input name="name" value={form.name} onChange={handleChange} placeholder="Product name" /></div>
              <div className="form-group"><label>Reference</label><input name="reference" value={form.reference} onChange={handleChange} placeholder="REF-001" /></div>
              <div className="form-group"><label>Description</label><textarea name="description" value={form.description} onChange={handleChange} placeholder="Product description..." /></div>
              <div className="form-row">
                <div className="form-group"><label>Unit Price (TND) *</label><input name="unit_price" type="number" step="0.01" min="0" value={form.unit_price} onChange={handleChange} placeholder="0.00" /></div>
                <div className="form-group"><label>Stock *</label><input name="stock" type="number" min="0" value={form.stock} onChange={handleChange} placeholder="0" /></div>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select name="category_id" value={form.category_id} onChange={handleChange}>
                  <option value="">-- Select a category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Image (URL)</label><input name="image" value={form.image} onChange={handleChange} placeholder="https://..." /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={productsLoading}>{productsLoading ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* IMPORT RESULT MODAL */}
      {showImportModal && importResult && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📥 CSV Import Result</h2>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Added', value: importResult.inserted ?? 0, color: '#10b981', bg: '#f0fdf4' },
                { label: 'Updated', value: importResult.updated ?? 0, color: '#3b82f6', bg: '#eff6ff' },
                { label: 'Errors', value: importResult.errors?.length ?? 0, color: '#ef4444', bg: '#fef2f2' },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, background: item.bg, borderRadius: '10px', padding: '0.85rem', textAlign: 'center', border: `1px solid ${item.color}30` }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: item.color }}>{item.value}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.label}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text)', marginBottom: '0.75rem' }}>{importResult.message}</p>
            {importResult.errors?.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.75rem', maxHeight: '160px', overflowY: 'auto' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', marginBottom: '0.4rem' }}>Error details:</p>
                {importResult.errors.map((e, i) => (
                  <p key={i} style={{ fontSize: '0.75rem', color: '#b91c1c', marginBottom: '0.2rem' }}>• {e}</p>
                ))}
              </div>
            )}
            {/* CSV format hint */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', marginTop: '1rem' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Expected format</p>
              <code style={{ fontSize: '0.72rem', color: '#4f46e5', display: 'block', lineHeight: 1.6 }}>
                nom;reference;description;prix;stock;categorie;image
              </code>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Separator: <strong>;</strong> or <strong>,</strong> — Encoding: UTF-8 — Required columns: <strong>nom, prix, stock</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowImportModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
