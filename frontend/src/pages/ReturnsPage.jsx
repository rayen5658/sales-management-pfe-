import React, { useEffect, useState } from 'react';
import { LuCheck, LuX, LuUndo2 } from 'react-icons/lu';
import { returnService } from '../services/api';
import { notifySuccess, notifyError, setupToasterGlobal } from '../utils/uxHelpers';
import '../styles/pages.css';

const STATUS_LABEL = { requested: 'Requested', approved: 'Approved', rejected: 'Rejected' };
const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

export default function ReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('requested');

  const [actionModal, setActionModal] = useState(null); // { returnRow, mode: 'approve'|'reject' }
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    returnService.getAll()
      .then(r => setReturns(r.data))
      .catch(err => setError(err.response?.status === 403 ? 'Access reserved for Administrators and Managers.' : 'Error loading returns.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = filterStatus ? returns.filter(r => r.status === filterStatus) : returns;

  const openAction = (returnRow, mode) => { setActionModal({ returnRow, mode }); setNote(''); };

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    if (actionModal.mode === 'reject' && !note.trim()) { notifyError('A reason is required to reject a return'); return; }
    setSaving(true);
    try {
      if (actionModal.mode === 'approve') {
        await returnService.approve(actionModal.returnRow.id, note || undefined);
        notifySuccess(`Return #${actionModal.returnRow.id} approved — stock restored`);
      } else {
        await returnService.reject(actionModal.returnRow.id, note);
        notifySuccess(`Return #${actionModal.returnRow.id} rejected`);
      }
      setActionModal(null);
      load();
    } catch (err) {
      notifyError(err.response?.data?.message || 'Could not update this return');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>;
  if (error) return <div className="page"><div className="alert alert-error">⚠ {error}</div></div>;

  return (
    <div className="page">
      {setupToasterGlobal()}
      <div className="page-header">
        <h1><LuUndo2 size={20} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />Returns <span className="count">{returns.length}</span></h1>
      </div>

      <div className="toolbar">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="requested">Requested</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No return requests {filterStatus ? `with status "${filterStatus}"` : ''}</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Order</th>
                <th>Client</th>
                <th>Reason</th>
                <th>Amount</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td><strong>#{r.order_id}</strong></td>
                  <td>{r.client_name || '—'}</td>
                  <td style={{ maxWidth: 260, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.reason}</td>
                  <td>{fmt(r.amount_ttc)}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(r.requested_at).toLocaleDateString('en-GB')}</td>
                  <td><span className={`badge badge-${r.status === 'approved' ? 'confirmed' : r.status === 'rejected' ? 'cancelled' : 'pending'}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td>
                    {r.status === 'requested' ? (
                      <div className="actions">
                        <button className="btn btn-success btn-icon" title="Approve" onClick={() => openAction(r, 'approve')}><LuCheck size={14} /></button>
                        <button className="btn btn-danger btn-icon" title="Reject" onClick={() => openAction(r, 'reject')}><LuX size={14} /></button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-faint)' }}>{r.resolution_note || '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {actionModal && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{actionModal.mode === 'approve' ? 'Approve' : 'Reject'} Return #{actionModal.returnRow.id}</h2>
              <button className="modal-close" onClick={() => setActionModal(null)}><LuX size={15} /></button>
            </div>
            {actionModal.mode === 'approve' && (
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                This restores the returned items to stock{actionModal.returnRow.payment_status === 'paid' ? ' and marks the order as refunded' : ''}.
              </p>
            )}
            <div className="form-group">
              <label>Note {actionModal.mode === 'reject' && '*'}</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={actionModal.mode === 'reject' ? 'Reason for rejecting (required)...' : 'Optional note...'} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setActionModal(null)}>Cancel</button>
              <button className={actionModal.mode === 'approve' ? 'btn btn-success' : 'btn btn-danger'} disabled={saving} onClick={handleConfirmAction}>
                {saving ? 'Saving…' : actionModal.mode === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
