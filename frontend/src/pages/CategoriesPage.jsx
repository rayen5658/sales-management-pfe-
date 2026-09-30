import React, { useEffect, useState } from 'react';
import { LuPlus, LuPencil, LuTrash2 } from 'react-icons/lu';
import { useDataStore } from '../stores/dataStore';
import { useAuthStore } from '../stores/authStore';
import { useSortableTable, SortIcon, sortableThStyle } from '../hooks/useSortableTable';
import '../styles/pages.css';

const EMPTY = { name: '', description: '', image: '', parent_id: '' };

export default function CategoriesPage() {
  const { categories, fetchCategories, categoriesLoading, createCategory, updateCategory, deleteCategory } = useDataStore();
  const { user } = useAuthStore();
  const canWrite = user?.role_name === 'Administrator' || user?.role_name === 'Manager';
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchCategories(); }, []);

  const filtered = categories.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  const { sorted: sortedCats, sortKey: catSortKey, sortDir: catSortDir, onSort: onCatSort } = useSortableTable(filtered, 'name', 'asc');

  const openCreate = () => { setForm(EMPTY); setEditing(null); setError(''); setShowModal(true); };
  const openEdit = (c) => { setForm({ name: c.name || '', description: c.description || '', image: c.image || '', parent_id: c.parent_id || '' }); setEditing(c.id); setError(''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setError(''); };
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.name) { setError('Name is required'); return; }
    try {
      if (editing) { await updateCategory(editing, form); setSuccess('Category updated'); }
      else { await createCategory(form); setSuccess('Category created'); }
      closeModal();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Server error'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    try { await deleteCategory(id); setSuccess('Category deleted'); setTimeout(() => setSuccess(''), 3000); }
    catch (err) { setError(err.response?.data?.error || 'Error during deletion'); }
  };

  const getParentName = (pid) => categories.find(c => c.id === pid)?.name || '—';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Categories <span className="count">{categories.length}</span></h1>
        {canWrite && <button className="btn btn-primary" onClick={openCreate}><LuPlus size={14} /> New Category</button>}
      </div>

      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && !showModal && <div className="alert alert-error">⚠ {error}</div>}

      <div className="toolbar">
        <input placeholder="Search for a category..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No categories found</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={sortableThStyle} onClick={() => onCatSort('id')}>#<SortIcon col="id" sortKey={catSortKey} sortDir={catSortDir} /></th>
                <th style={sortableThStyle} onClick={() => onCatSort('name')}>Name<SortIcon col="name" sortKey={catSortKey} sortDir={catSortDir} /></th>
                <th>Description</th>
                <th>Parent Category</th>
                <th style={sortableThStyle} onClick={() => onCatSort('product_count')}>Products<SortIcon col="product_count" sortKey={catSortKey} sortDir={catSortDir} /></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedCats.map(c => (
                <tr key={c.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{c.id}</td>
                  <td><strong>{c.name}</strong></td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.description || '—'}</td>
                  <td>{c.parent_id ? <span className="badge badge-shipped">{getParentName(c.parent_id)}</span> : <span style={{ color: 'var(--text-muted)' }}>Root</span>}</td>
                  <td>
                    <span className={`badge ${parseInt(c.product_count) > 0 ? 'badge-active' : 'badge-inactive'}`}>
                      {c.product_count || 0} product{parseInt(c.product_count) !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td>
                    <div className="actions">
                      {canWrite && <button className="btn btn-warning btn-icon" title="Edit" onClick={() => openEdit(c)}><LuPencil size={14} /></button>}
                      {canWrite && <button className="btn btn-danger btn-icon" title="Delete" onClick={() => handleDelete(c.id, c.name)}><LuTrash2 size={14} /></button>}
                      {!canWrite && <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>View only</span>}
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
              <h2>{editing ? 'Edit Category' : 'New Category'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Name *</label><input name="name" value={form.name} onChange={handleChange} placeholder="Category name" /></div>
              <div className="form-group"><label>Description</label><textarea name="description" value={form.description} onChange={handleChange} placeholder="Description..." /></div>
              <div className="form-group">
                <label>Parent Category</label>
                <select name="parent_id" value={form.parent_id} onChange={handleChange}>
                  <option value="">-- None (root category) --</option>
                  {categories.filter(c => c.id !== editing).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Image (URL)</label><input name="image" value={form.image} onChange={handleChange} placeholder="https://..." /></div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={categoriesLoading}>{categoriesLoading ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
