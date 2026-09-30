import { useState, useMemo } from 'react';

/**
 * useSortableTable — generic client-side sort hook
 *
 * @param {Array}  data      — the array to sort
 * @param {string} defaultKey — initial sort column key
 * @param {string} defaultDir — 'asc' | 'desc'
 * @returns {{ sorted, sortKey, sortDir, onSort }}
 */
export function useSortableTable(data, defaultKey = '', defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const onSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey || !data?.length) return data || [];
    return [...data].sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];

      // Nulls last
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      // Numbers
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn)) {
        return sortDir === 'asc' ? an - bn : bn - an;
      }

      // Dates
      const ad = new Date(av);
      const bd = new Date(bv);
      if (!isNaN(ad) && !isNaN(bd) && String(av).includes('-')) {
        return sortDir === 'asc' ? ad - bd : bd - ad;
      }

      // Strings
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, onSort };
}

/**
 * SortIcon — renders ↑ ↓ ↕ next to the active header
 */
export function SortIcon({ col, sortKey, sortDir }) {
  if (col !== sortKey) {
    return <span style={{ marginLeft: '4px', opacity: 0.3, fontSize: '0.7rem' }}>↕</span>;
  }
  return (
    <span style={{ marginLeft: '4px', color: '#0d9488', fontSize: '0.75rem', fontWeight: 700 }}>
      {sortDir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

/**
 * sortableTh — style for a clickable <th>
 */
export const sortableThStyle = {
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};
