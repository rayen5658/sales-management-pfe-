/**
 * Reusable pagination bar.
 *
 * Props:
 *   pagination  – { page, totalPages, total, limit, hasNext, hasPrev }
 *   onPageChange – (newPage: number) => void
 *   loading      – bool  (disables buttons while a fetch is in flight)
 */
export default function Pagination({ pagination, onPageChange, loading = false }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, total, limit } = pagination;
  const from = (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  // Build visible page numbers: always show first, last, current ±1, with ellipsis
  const pages = [];
  const add = (n) => { if (n >= 1 && n <= totalPages && !pages.includes(n)) pages.push(n); };
  add(1);
  add(page - 1); add(page); add(page + 1);
  add(totalPages);
  pages.sort((a, b) => a - b);

  // Insert ellipsis markers
  const withGaps = [];
  for (let i = 0; i < pages.length; i++) {
    if (i > 0 && pages[i] - pages[i - 1] > 1) withGaps.push('…');
    withGaps.push(pages[i]);
  }

  const btnBase = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: '2rem', height: '2rem', padding: '0 0.5rem',
    borderRadius: '6px', border: '1.5px solid var(--border)',
    fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.15s', background: '#fff', color: 'var(--text)',
    lineHeight: 1,
  };
  const btnActive  = { ...btnBase, background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' };
  const btnDisabled = { ...btnBase, opacity: 0.4, cursor: 'not-allowed' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.25rem' }}>
      {/* Info text */}
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Showing <strong>{from}–{to}</strong> of <strong>{total}</strong>
      </span>

      {/* Page buttons */}
      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          style={page === 1 || loading ? btnDisabled : btnBase}
          disabled={page === 1 || loading}
          onClick={() => onPageChange(page - 1)}
          title="Previous page"
          aria-label="Previous page"
        >
          ‹
        </button>

        {withGaps.map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} style={{ padding: '0 0.3rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>…</span>
          ) : (
            <button
              key={p}
              style={p === page ? btnActive : (loading ? btnDisabled : btnBase)}
              disabled={loading}
              onClick={() => p !== page && onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}

        <button
          style={page === totalPages || loading ? btnDisabled : btnBase}
          disabled={page === totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          title="Next page"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
