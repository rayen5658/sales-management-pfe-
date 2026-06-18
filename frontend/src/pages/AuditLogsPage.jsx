import React, { useEffect, useState } from 'react';
import { auditService } from '../services/api';
import '../styles/pages.css';

const ACTION_COLORS = {
  LOGIN:              { bg: '#dbeafe', color: '#1e40af', icon: 'LOGIN' },
  USER_STATUS_CHANGE: { bg: '#fef3c7', color: '#92400e', icon: 'USER' },
  PASSWORD_RESET:     { bg: '#ffedd5', color: '#9a3412', icon: 'PWD' },
  USER_DELETE:        { bg: '#fee2e2', color: '#991b1b', icon: 'DEL' },
  ORDER_CANCEL:       { bg: '#fee2e2', color: '#991b1b', icon: 'X' },
  ORDER_SHIPPED:      { bg: '#dcfce7', color: '#166534', icon: 'SHIP' },
  CLIENT_ARCHIVE:     { bg: '#fef3c7', color: '#92400e', icon: 'ARC' },
  CLIENT_RESTORE:     { bg: '#dcfce7', color: '#166534', icon: 'RST' },
};

export default function AuditLogsPage() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    auditService.getLogs()
      .then(r => setLogs(r.data))
      .catch(err => {
        if (err.response?.status === 403) setError('Access reserved for Administrators.');
        else setError('Error loading logs.');
      })
      .finally(() => setLoading(false));
  }, []);

  const actions = [...new Set(logs.map(l => l.action))];

  const filtered = logs.filter(l => {
    const matchSearch = !search ||
      l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase());
    const matchAction = !filterAction || l.action === filterAction;
    return matchSearch && matchAction;
  });

  if (loading) return (
    <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading logs...</div>
  );

  if (error) return (
    <div className="page">
      <div className="alert alert-error">⚠ {error}</div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1>Audit Logs <span className="count">{logs.length}</span></h1>
      </div>

      <div className="toolbar">
        <input
          placeholder="Search by user or detail..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}>
          <option value="">All actions</option>
          {actions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No logs found</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date / Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => {
                const style = ACTION_COLORS[log.action] || { bg: '#f1f5f9', color: '#475569', icon: '...' };
                return (
                  <tr key={log.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{log.id}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleDateString('en-GB')}{' '}
                      <span style={{ color: '#94a3b8' }}>
                        {new Date(log.timestamp).toLocaleTimeString('en-GB')}
                      </span>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: '0.875rem' }}>{log.user_name || '—'}</strong>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.user_email || ''}</p>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        background: style.bg,
                        color: style.color,
                        padding: '0.2rem 0.65rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                      {log.details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
