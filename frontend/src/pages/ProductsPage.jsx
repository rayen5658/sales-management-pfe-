import React, { useEffect, useState, useRef, useCallback } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuDownload, LuUpload, LuX, LuLayers } from 'react-icons/lu';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import { productService, variantService } from '../services/api';
import { ConfirmDialog, notifySuccess, notifyError, setupToasterGlobal } from '../utils/uxHelpers';
import { useSortableTable, SortIcon, sortableThStyle } from '../hooks/useSortableTable';
import Pagination from '../components/common/Pagination';
import '../styles/pages.css';

const EMPTY = { name: '', reference: '', description: '', unit_price: '', stock: '', category_id: '', image: '' };
const EMPTY_VARIANT = { name: '', reference: '', unit_price: '', stock: '' };
const PAGE_SIZE = 20;

const IMG_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" rx="6" fill="%23f1f5f9"/><rect x="14" y="14" width="20" height="20" rx="3" fill="%23cbd5e1"/><rect x="17" y="17" width="8" height="8" rx="1" fill="%23e2e8f0"/></svg>`;

function exportToCSV(products, categories) {
  const getCatName = (id) => categories.find(c => c.id === id)?.name || '';
  const headers = ['ID', 'Reference', 'Name', 'Description', 'Unit Price (TND)', 'Stock', 'Category'];
  const rows = products.map(p => [
    p.id, p.reference || '',
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.description || '').replace(/"/g, '""')}"`,
    parseFloat(p.unit_price || 0).toFixed(2), p.stock,
    getCatName(p.category_id),
  ]);
  const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `products_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function ProductsPage() {
  const {
    products, fetchProducts, productsLoading, productsPagination,
    createProduct, updateProduct, deleteProduct,
    categories, fetchCategories,
  } = useDataStore();
  const { user } = useAuthStore();
  const canWrite = user?.role_name === 'Administrator' || user?.role_name === 'Manager';
  const canDelete = user?.role_name === 'Administrator';

  // â”€â”€ Filters (server-side) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStock, setFilterStock] = useState('');
  const [page, setPage]           = useState(1);

  // â”€â”€ Modals / forms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState(EMPTY);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Variants modal ───────────────────────────────────────────────────────────
  const [variantsModal, setVariantsModal]   = useState(null); // product object
  const [variants, setVariants]             = useState([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantForm, setVariantForm]       = useState(EMPTY_VARIANT);
  const [editingVariant, setEditingVariant] = useState(null); // variant id
  const [variantError, setVariantError]     = useState('');
  const [variantSaving, setVariantSaving]   = useState(false);
  const [deleteVariantConfirm, setDeleteVariantConfirm] = useState(null);

  // â”€â”€ CSV import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [importLoading, setImportLoading]   = useState(false);
  const [importResult, setImportResult]     = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const csvInputRef = useRef(null);

  // â”€â”€ Fetch with current filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const load = useCallback((p = page) => {
    const params = { page: p, limit: PAGE_SIZE };
    if (search.trim())  params.search    = search.trim();
    if (filterCat)      params.category_id = filterCat;
    if (filterStock === 'low') params.low_stock = true;
    fetchProducts(params);
  }, [page, search, filterCat, filterStock, fetchProducts]);

  // Accepts explicit values so filters apply immediately without waiting for state
  const loadWithValues = useCallback((searchVal, catVal, stockVal, p = 1) => {
    const params = { page: p, limit: PAGE_SIZE };
    if (searchVal?.trim()) params.search      = searchVal.trim();
    if (catVal)            params.category_id = catVal;
    if (stockVal === 'low') params.low_stock  = true;
    fetchProducts(params);
  }, [fetchProducts]);

  // Initial load + reload on filter/page changes
  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { load(page); }, [page]);
  // Auto-apply when dropdowns change
  useEffect(() => { setPage(1); loadWithValues(search, filterCat, filterStock, 1); }, [filterCat, filterStock]);

  // When filters change reset to page 1 and reload
  const applyFilters = () => { setPage(1); loadWithValues(search, filterCat, filterStock, 1); };
  const resetFilters = () => {
    setSearch(''); setFilterCat(''); setFilterStock('');
    setPage(1);
    fetchProducts({ page: 1, limit: PAGE_SIZE });
  };

  // Client-side sort on the current page's data (no re-fetch needed)
  const { sorted: sortedProducts, sortKey: pSortKey, sortDir: pSortDir, onSort: onPSort } =
    useSortableTable(products, 'name', 'asc');

  const lowStockCount = products.filter(p => parseInt(p.stock) <= 5).length;

  // â”€â”€ CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openCreate = () => { setForm(EMPTY); setEditing(null); setError(''); setShowModal(true); };
  const openEdit   = (p)  => {
    setForm({ name: p.name||'', reference: p.reference||'', description: p.description||'',
              unit_price: p.unit_price||'', stock: p.stock||'', category_id: p.category_id||'', image: p.image||'' });
    setEditing(p.id); setError(''); setShowModal(true);
  };
  const closeModal  = () => { setShowModal(false); setError(''); };
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault(); setError('');
    if (!form.name || !form.unit_price || form.stock === '') { setError('Name, price and stock are required'); return; }
    try {
      if (editing) { await updateProduct(editing, form); setSuccess('Product updated'); }
      else         { await createProduct(form);          setSuccess('Product created'); }
      closeModal();
      load(page);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Server error'); }
  };

  const handleDelete = (id, name) => setDeleteConfirm({ id, name });
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      await deleteProduct(deleteConfirm.id);
      notifySuccess(`"${deleteConfirm.name}" deleted`);
      setDeleteConfirm(null);
      load(page);
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('foreign key') || msg.includes('violates') || err.response?.status === 500)
        notifyError(`Cannot delete "${deleteConfirm.name}" — it is linked to existing orders.`);
      else notifyError(msg || 'Error during deletion');
    } finally { setDeleteLoading(false); setDeleteConfirm(null); }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportLoading(true); setImportResult(null);
    try {
      const res = await productService.importCSV(file);
      setImportResult(res.data); setShowImportModal(true);
      load(1); setPage(1);
    } catch (err) {
      setImportResult({ message: err.response?.data?.error || 'Error during import', inserted: 0, updated: 0, errors: [] });
      setShowImportModal(true);
    } finally { setImportLoading(false); }
  };

  // ── Variants CRUD ────────────────────────────────────────────────────────────
  const openVariants = async (product) => {
    setVariantsModal(product);
    setVariants([]);
    setVariantForm(EMPTY_VARIANT);
    setEditingVariant(null);
    setVariantError('');
    setVariantsLoading(true);
    try {
      const r = await variantService.getByProduct(product.id);
      setVariants(r.data);
    } catch { setVariantError('Error loading variants'); }
    finally { setVariantsLoading(false); }
  };
  const closeVariants = () => { setVariantsModal(null); setVariants([]); };

  const openVariantEdit = (v) => {
    setEditingVariant(v.id);
    setVariantForm({ name: v.name || '', reference: v.reference || '', unit_price: v.unit_price || '', stock: v.stock ?? '' });
    setVariantError('');
  };
  const cancelVariantEdit = () => { setEditingVariant(null); setVariantForm(EMPTY_VARIANT); setVariantError(''); };

  const handleVariantSubmit = async (e) => {
    e.preventDefault();
    setVariantError('');
    if (!variantForm.name || variantForm.unit_price === '') { setVariantError('Name and price are required'); return; }
    setVariantSaving(true);
    try {
      if (editingVariant) {
        const r = await variantService.update(editingVariant, variantForm);
        setVariants(vs => vs.map(v => v.id === editingVariant ? r.data : v));
      } else {
        const r = await variantService.create(variantsModal.id, variantForm);
        setVariants(vs => [...vs, r.data]);
      }
      setVariantForm(EMPTY_VARIANT);
      setEditingVariant(null);
    } catch (err) {
      setVariantError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Server error');
    } finally { setVariantSaving(false); }
  };

  const confirmDeleteVariant = async () => {
    if (!deleteVariantConfirm) return;
    try {
      await variantService.delete(deleteVariantConfirm.id);
      setVariants(vs => vs.filter(v => v.id !== deleteVariantConfirm.id));
      notifySuccess('Variant deleted');
    } catch (err) {
      notifyError(err.response?.data?.message || 'Error deleting variant');
    } finally { setDeleteVariantConfirm(null); }
  };

  const total = productsPagination?.total ?? products.length;

  return (
    <div className="page">
      {setupToasterGlobal()}

      <div className="page-header">
        <h1>Products <span className="count" data-chatbot="products-total">{total}</span></h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {lowStockCount > 0 && (
            <button
              className={`btn ${filterStock === 'low' ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => {
                const newStock = filterStock === 'low' ? '' : 'low';
                setFilterStock(newStock);
                setPage(1);
              }}
              title="Show only low-stock products"
            >
              {lowStockCount} low stock
            </button>
          )}
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleCSVImport} />
          {canWrite && (
            <button className="btn btn-ghost" onClick={() => csvInputRef.current?.click()} disabled={importLoading} title="Import from CSV">
              <LuUpload size={14} /> {importLoading ? 'Importing...' : 'Import CSV'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => exportToCSV(products, categories)} title="Export to CSV">
            <LuDownload size={14} /> Export CSV
          </button>
          {canWrite && (
            <button className="btn btn-primary" onClick={openCreate}><LuPlus size={14} /> New Product</button>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && !showModal && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="toolbar">
        <input
          placeholder="Search by name or reference..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && applyFilters()}
        />
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <select value={filterStock} onChange={e => { setFilterStock(e.target.value); setPage(1); }}>
          <option value="">All stock levels</option>
          <option value="low">Low stock (&le; 5)</option>
          <option value="ok"> In stock (&gt; 5)</option>
        </select>
        <button className="btn btn-primary" onClick={applyFilters}>Search</button>
        {(search || filterCat || filterStock) && (
          <button className="btn btn-ghost" onClick={resetFilters}>Reset</button>
        )}
      </div>

      {/* Table */}
      <div className="table-wrap">
        {productsLoading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : sortedProducts.length === 0 ? (
          <div className="empty-state"><p>No products found</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '56px' }}>Img</th>
                <th style={sortableThStyle} onClick={() => onPSort('id')}>#<SortIcon col="id" sortKey={pSortKey} sortDir={pSortDir} /></th>
                <th style={sortableThStyle} onClick={() => onPSort('reference')}>Reference<SortIcon col="reference" sortKey={pSortKey} sortDir={pSortDir} /></th>
                <th style={sortableThStyle} onClick={() => onPSort('name')}>Name<SortIcon col="name" sortKey={pSortKey} sortDir={pSortDir} /></th>
                <th style={sortableThStyle} onClick={() => onPSort('unit_price')}>Unit Price<SortIcon col="unit_price" sortKey={pSortKey} sortDir={pSortDir} /></th>
                <th style={sortableThStyle} onClick={() => onPSort('stock')}>Stock<SortIcon col="stock" sortKey={pSortKey} sortDir={pSortDir} /></th>
                <th>Category</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map(p => (
                <tr key={p.id}>
                  <td>
                    <img
                      src={p.image || IMG_PLACEHOLDER}
                      alt={p.name}
                      onError={e => { e.currentTarget.src = IMG_PLACEHOLDER; }}
                      style={{ width: '44px', height: '44px', objectFit: 'contain', borderRadius: '6px', background: 'var(--card-bg-2)', border: '1px solid var(--border)', display: 'block' }}
                    />
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.id}</td>
                  <td><code data-chatbot="product-reference" style={{ background: 'var(--card-bg-2)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>{p.reference || '—'}</code></td>
                  <td>
                    <strong data-chatbot="product-name">{p.name}</strong>
                    {p.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{p.description.substring(0, 50)}{p.description.length > 50 ? '...' : ''}</p>}
                  </td>
                  <td><strong data-chatbot="product-price">{parseFloat(p.unit_price || 0).toFixed(2)} TND</strong></td>
                  <td><span data-chatbot="product-stock" className={`badge ${parseInt(p.stock) <= 5 ? 'badge-cancelled' : 'badge-active'}`}>{p.stock} units</span></td>
                  <td data-chatbot="product-category" style={{ color: 'var(--text-muted)' }}>{categories.find(c => c.id === p.category_id)?.name || '—'}</td>
                  <td>
                    <div className="actions">
                      {canWrite && <button className="btn btn-ghost btn-icon" title="Manage variants" onClick={() => openVariants(p)} style={{ color: '#0d9488' }}><LuLayers size={14} /></button>}
                      {canWrite && <button className="btn btn-warning btn-icon" title="Edit" onClick={() => openEdit(p)}><LuPencil size={14} /></button>}
                      {canDelete && <button className="btn btn-danger btn-icon" title="Delete" onClick={() => handleDelete(p.id, p.name)}><LuTrash2 size={14} /></button>}
                      {!canWrite && !canDelete && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>View only</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        pagination={productsPagination}
        onPageChange={(p) => setPage(p)}
        loading={productsLoading}
      />

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Product' : 'New Product'}</h2>
              <button className="modal-close" onClick={closeModal}><LuX size={15} /></button>
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
              <div className="form-group">
                <label>Image (URL)</label>
                <input name="image" value={form.image} onChange={handleChange} placeholder="https://..." />
                {form.image && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <img src={form.image} alt="preview" onError={e => { e.currentTarget.src = IMG_PLACEHOLDER; }}
                      style={{ width: '72px', height: '72px', objectFit: 'contain', borderRadius: '8px', background: 'var(--card-bg-2)', border: '1px solid var(--border)' }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Image preview</span>
                  </div>
                )}
              </div>
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
              <h2>CSV Import Result</h2>
              <button className="modal-close" onClick={() => setShowImportModal(false)}><LuX size={15} /></button>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Added',   value: importResult.inserted ?? 0, color: '#10b981', bg: '#f0fdf4' },
                { label: 'Updated', value: importResult.updated  ?? 0, color: '#3b82f6', bg: '#eff6ff' },
                { label: 'Errors',  value: importResult.errors?.length ?? 0, color: '#ef4444', bg: '#fef2f2' },
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, background: item.bg, borderRadius: '10px', padding: '0.85rem', textAlign: 'center', border: `1px solid ${item.color}30` }}>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: item.color }}>{item.value}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.label}</p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text)', marginBottom: '0.75rem' }}>{importResult.message}</p>
            {importResult.errors?.length > 0 && (
              <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: '8px', padding: '0.75rem', maxHeight: '160px', overflowY: 'auto' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--danger-text)', marginBottom: '0.4rem' }}>Error details:</p>
                {importResult.errors.map((e, i) => <p key={i} style={{ fontSize: '0.75rem', color: 'var(--danger-text)', marginBottom: '0.2rem' }}>• {e}</p>)}
              </div>
            )}
            <div style={{ background: 'var(--card-bg-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', marginTop: '1rem' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>Expected format</p>
              <code style={{ fontSize: '0.72rem', color: '#0d9488', display: 'block', lineHeight: 1.6 }}>nom;reference;description;prix;stock;categorie;image</code>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                Separator: <strong>;</strong> or <strong>,</strong> — Encoding: UTF-8 — Required: <strong>nom, prix, stock</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowImportModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete this product?"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Yes, delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        isLoading={deleteLoading}
      />

      {/* VARIANTS MODAL */}
      {variantsModal && (
        <div className="modal-overlay" onClick={closeVariants}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Variants — {variantsModal.name}</h2>
              <button className="modal-close" onClick={closeVariants}><LuX size={15} /></button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Each variant has its own price and stock (e.g. "16GB RAM", "Red"). When a client orders a specific variant, price and stock come from the variant, not the base product.
            </p>

            {variantsLoading ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-faint)' }}>Loading...</div>
            ) : (
              <>
                {variants.length === 0 ? (
                  <div className="empty-state" style={{ padding: '1.5rem' }}><p>No variants yet — this product uses its base price and stock.</p></div>
                ) : (
                  <table className="data-table" style={{ marginBottom: '1rem' }}>
                    <thead>
                      <tr><th>Name</th><th>Reference</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {variants.map(v => (
                        <tr key={v.id}>
                          <td><strong>{v.name}</strong></td>
                          <td style={{ color: 'var(--text-muted)' }}>{v.reference || '—'}</td>
                          <td>{parseFloat(v.unit_price).toFixed(2)} TND</td>
                          <td><span className={`badge ${parseInt(v.stock) <= 5 ? 'badge-cancelled' : 'badge-active'}`}>{v.stock} units</span></td>
                          <td>
                            <div className="actions">
                              <button className="btn btn-warning btn-icon" title="Edit" onClick={() => openVariantEdit(v)}><LuPencil size={14} /></button>
                              <button className="btn btn-danger btn-icon" title="Delete" onClick={() => setDeleteVariantConfirm(v)}><LuTrash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={{ background: 'var(--card-bg-2)', borderRadius: '10px', padding: '1rem', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
                    {editingVariant ? 'Edit variant' : 'Add a variant'}
                  </p>
                  {variantError && <div className="alert alert-error">{variantError}</div>}
                  <form onSubmit={handleVariantSubmit}>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name *</label>
                        <input value={variantForm.name} onChange={e => setVariantForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 16GB RAM" />
                      </div>
                      <div className="form-group">
                        <label>Reference</label>
                        <input value={variantForm.reference} onChange={e => setVariantForm(f => ({ ...f, reference: e.target.value }))} placeholder="Optional" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Unit Price (TND) *</label>
                        <input type="number" step="0.01" min="0" value={variantForm.unit_price} onChange={e => setVariantForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="0.00" />
                      </div>
                      <div className="form-group">
                        <label>Stock</label>
                        <input type="number" min="0" value={variantForm.stock} onChange={e => setVariantForm(f => ({ ...f, stock: e.target.value }))} placeholder="0" />
                      </div>
                    </div>
                    <div className="modal-actions">
                      {editingVariant && <button type="button" className="btn btn-ghost" onClick={cancelVariantEdit}>Cancel edit</button>}
                      <button type="submit" className="btn btn-primary" disabled={variantSaving}>
                        {variantSaving ? 'Saving...' : editingVariant ? 'Save changes' : 'Add variant'}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}

            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-ghost" onClick={closeVariants}>Close</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteVariantConfirm}
        title="Delete this variant?"
        message={`Are you sure you want to delete "${deleteVariantConfirm?.name}"? This action cannot be undone.`}
        confirmText="Yes, delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={confirmDeleteVariant}
        onCancel={() => setDeleteVariantConfirm(null)}
      />
    </div>
  );
}
