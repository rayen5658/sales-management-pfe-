import React, { useEffect, useState } from 'react';
import { LuStar } from 'react-icons/lu';
import { feedbackService } from '../services/api';
import '../styles/pages.css';

function Stars({ rating }) {
  return (
    <span style={{ display: 'inline-flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <LuStar key={i} size={14} fill={i <= rating ? '#eab308' : 'none'} color={i <= rating ? '#eab308' : 'var(--border)'} />
      ))}
    </span>
  );
}

export default function FeedbackPage() {
  const [data, setData] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [minRating, setMinRating] = useState('');

  useEffect(() => {
    feedbackService.getAll()
      .then(r => { setData(r.data.data); setAvgRating(r.data.avg_rating); setTotal(r.data.total); })
      .catch(err => setError(err.response?.status === 403 ? 'Access reserved for Administrators and Managers.' : 'Error loading feedback.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = minRating ? data.filter(f => f.rating >= parseInt(minRating)) : data;

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>;
  if (error) return <div className="page"><div className="alert alert-error">⚠ {error}</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1><LuStar size={20} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />Client Feedback <span className="count">{total}</span></h1>
      </div>

      {total > 0 && (
        <div className="kpi-card" style={{ maxWidth: 260, marginBottom: '1.25rem' }}>
          <div className="kpi-icon" style={{ background: '#fef9c3', color: '#a16207' }}><LuStar size={20} /></div>
          <p className="kpi-label">Average Rating</p>
          <p className="kpi-value" style={{ color: '#a16207' }}>{avgRating} / 5</p>
          <p className="kpi-sub">from {total} review{total !== 1 ? 's' : ''}</p>
        </div>
      )}

      <div className="toolbar">
        <select value={minRating} onChange={e => setMinRating(e.target.value)}>
          <option value="">All ratings</option>
          <option value="5">5 stars</option>
          <option value="4">4+ stars</option>
          <option value="3">3+ stars</option>
          <option value="2">2+ stars</option>
          <option value="1">1+ stars</option>
        </select>
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state"><p>No feedback yet</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Order</th>
                <th>Client</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id}>
                  <td>{f.id}</td>
                  <td><strong>#{f.order_id}</strong></td>
                  <td>{f.client_name || '—'}</td>
                  <td><Stars rating={f.rating} /></td>
                  <td style={{ maxWidth: 320, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{f.comment || <span style={{ color: 'var(--text-faint)' }}>—</span>}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(f.created_at).toLocaleDateString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
