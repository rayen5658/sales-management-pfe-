import React, { useEffect, useState } from 'react';
import { LuPlus, LuPencil, LuTrash2, LuLock, LuToggleLeft, LuToggleRight } from 'react-icons/lu';
import { userService, roleService } from '../services/api';
import { useSortableTable, SortIcon, sortableThStyle } from '../hooks/useSortableTable';
import '../styles/pages.css';

const EMPTY_USER = { firstname: '', lastname: '', email: '', password: '', role_id: '', status: 'active' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_USER);
  const [newPwd, setNewPwd] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const [u, r] = await Promise.all([userService.getAll(), roleService.getAll()]);
      setUsers(u.data);
      setRoles(r.data);
    } catch (err) {
      if (err.response?.status === 403) {
        setError('Access denied — this page is reserved for Administrators.');
      } else {
        setError('Error loading users. Make sure the server is running.');
      }
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    `${u.firstname} ${u.lastname} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const { sorted: sortedUsers, sortKey: uSortKey, sortDir: uSortDir, onSort: onUSort } = useSortableTable(filtered, 'firstname', 'asc');

  const openCreate = () => { setForm(EMPTY_USER); setEditing(null); setError(''); setShowModal(true); };
  const openEdit = (u) => { setForm({ firstname: u.firstname, lastname: u.lastname, email: u.email, password: '', role_id: u.role_id, status: u.status }); setEditing(u.id); setError(''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setError(''); };
  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.firstname || !form.lastname || !form.email || !form.role_id) { setError('All required fields must be filled'); return; }
    try {
      if (editing) {
        await userService.update(editing, form);
        setSuccess('User updated');
      } else {
        if (!form.password || form.password.length < 6) { setError('Password required (min 6 characters)'); return; }
        await userService.register({ ...form, role_id: parseInt(form.role_id) });
        setSuccess('User created');
      }
      closeModal();
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || 'Server error'); }
  };

  const handleToggle = async (u) => {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await userService.toggleStatus(u.id, newStatus);
      setSuccess(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Error changing status'); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"?`)) return;
    try {
      await userService.delete(id);
      setSuccess('User deleted');
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.response?.data?.message || 'Error during deletion'); }
  };

  const handleResetPwd = async () => {
    if (!newPwd || newPwd.length < 6) { setError('Password min 6 characters'); return; }
    try {
      await userService.resetPassword(showPwdModal, newPwd);
      setSuccess('Password reset');
      setShowPwdModal(null);
      setNewPwd('');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Error during reset'); }
  };

  const getRoleName = (id) => roles.find(r => r.id === id)?.name || '—';

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Users <span className="count">{users.length}</span></h1>
        <button className="btn btn-primary" onClick={openCreate}><LuPlus size={14} /> New User</button>
      </div>

      {success && <div className="alert alert-success">✅ {success}</div>}
      {error && !showModal && !showPwdModal && <div className="alert alert-error">⚠ {error}</div>}

      <div className="toolbar">
        <input placeholder="Search for a user..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={sortableThStyle} onClick={() => onUSort('id')}>#<SortIcon col="id" sortKey={uSortKey} sortDir={uSortDir} /></th>
              <th style={sortableThStyle} onClick={() => onUSort('firstname')}>Name<SortIcon col="firstname" sortKey={uSortKey} sortDir={uSortDir} /></th>
              <th style={sortableThStyle} onClick={() => onUSort('email')}>Email<SortIcon col="email" sortKey={uSortKey} sortDir={uSortDir} /></th>
              <th style={sortableThStyle} onClick={() => onUSort('role_name')}>Role<SortIcon col="role_name" sortKey={uSortKey} sortDir={uSortDir} /></th>
              <th style={sortableThStyle} onClick={() => onUSort('status')}>Status<SortIcon col="status" sortKey={uSortKey} sortDir={uSortDir} /></th>
              <th style={sortableThStyle} onClick={() => onUSort('last_login')}>Last Login<SortIcon col="last_login" sortKey={uSortKey} sortDir={uSortDir} /></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><p>No users found</p></div></td></tr>
            ) : sortedUsers.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td><strong>{u.firstname} {u.lastname}</strong></td>
                <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                <td><span className={`badge badge-${u.role_name}`}>{u.role_name || getRoleName(u.role_id)}</span></td>
                <td><span className={`badge badge-${u.status}`}>{u.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {u.last_login ? new Date(u.last_login).toLocaleDateString('en-GB') : 'Never'}
                </td>
                <td>
                  <div className="actions">
                    <button className="btn btn-warning btn-icon" title="Edit" onClick={() => openEdit(u)}><LuPencil size={14} /></button>
                    <button className="btn btn-ghost btn-icon" title="Reset password" onClick={() => { setShowPwdModal(u.id); setError(''); }}><LuLock size={14} /></button>
                    <button className={`btn btn-icon ${u.status === 'active' ? 'btn-success' : 'btn-ghost'}`} title={u.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => handleToggle(u)}>
                      {u.status === 'active' ? <LuToggleRight size={16} /> : <LuToggleLeft size={16} />}
                    </button>
                    <button className="btn btn-danger btn-icon" title="Delete" onClick={() => handleDelete(u.id, `${u.firstname} ${u.lastname}`)}><LuTrash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit User' : 'New User'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label>First Name *</label><input name="firstname" value={form.firstname} onChange={handleChange} placeholder="First name" /></div>
                <div className="form-group"><label>Last Name *</label><input name="lastname" value={form.lastname} onChange={handleChange} placeholder="Last name" /></div>
              </div>
              <div className="form-group"><label>Email *</label><input name="email" type="email" value={form.email} onChange={handleChange} placeholder="email@example.com" /></div>
              {!editing && <div className="form-group"><label>Password *</label><input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Min 6 characters" /></div>}
              <div className="form-row">
                <div className="form-group">
                  <label>Role *</label>
                  <select name="role_id" value={form.role_id} onChange={handleChange}>
                    <option value="">-- Select --</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={form.status} onChange={handleChange}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showPwdModal && (
        <div className="modal-overlay" onClick={() => setShowPwdModal(null)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔒 Reset Password</h2>
              <button className="modal-close" onClick={() => setShowPwdModal(null)}>✕</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowPwdModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPwd}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
