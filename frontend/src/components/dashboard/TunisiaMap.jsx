import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import tunisiaPaths from '../../assets/tunisia-paths.json';

// Map governorate names → our DB region names
const GOV_TO_REGION = {
  'Tunis':       'Tunis',
  'Ariana':      'Tunis',
  'Ben Arous':   'Tunis',
  'Manouba':     'Tunis',
  'Nabeul':      'Nabeul',
  'Zaghouan':    'Nabeul',
  'Bizerte':     'Bizerte',
  'Béja':        'Autre',
  'Jendouba':    'Autre',
  'El Kef':      'Autre',
  'Siliana':     'Autre',
  'Sousse':      'Sousse',
  'Monastir':    'Monastir',
  'Mahdia':      'Monastir',
  'Sfax':        'Sfax',
  'Kairouan':    'Autre',
  'Kasserine':   'Autre',
  'Sidi Bouzid': 'Autre',
  'Gabès':       'Gabès',
  'Médenine':    'Gabès',
  'Tataouine':   'Autre',
  'Gafsa':       'Gafsa',
  'Tozeur':      'Autre',
  'Kébili':      'Autre',
};

const fmt = (v) =>
  new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 0 }).format(Math.round(v || 0)) + ' TND';

function getColor(revenue, maxRevenue) {
  if (!revenue || maxRevenue === 0) return '#e2e8f0';
  const t = Math.min(revenue / maxRevenue, 1);
  const r = Math.round(224 - t * (224 - 55));
  const g = Math.round(231 - t * (231 - 48));
  const b = Math.round(255 - t * (255 - 163));
  return `rgb(${r},${g},${b})`;
}

export default function TunisiaMap({ regionData, onRegionClick, selectedRegion }) {
  const regionMap = {};
  let maxRevenue = 0;
  regionData.forEach(r => {
    regionMap[r.region] = r;
    const rev = parseFloat(r.revenue);
    if (rev > maxRevenue) maxRevenue = rev;
  });

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox="0 0 300 500"
        style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '460px' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {tunisiaPaths.map(({ name, d }) => {
          const region     = GOV_TO_REGION[name] || 'Autre';
          const data       = regionMap[region];
          const revenue    = data ? parseFloat(data.revenue) : 0;
          const isSelected = selectedRegion === region;
          const fill       = isSelected ? '#0d9488' : getColor(revenue, maxRevenue);

          return (
            <path
              key={name}
              d={d}
              fill={fill}
              stroke="#fff"
              strokeWidth="0.5"
              style={{ cursor: 'pointer', transition: 'fill 0.2s' }}
              data-tooltip-id="map-tooltip"
              data-tooltip-content={
                data
                  ? `${name} (${region}) — Revenue: ${fmt(revenue)} | ${data.orders} order(s)`
                  : `${name} (${region}) — No sales`
              }
              onClick={() => onRegionClick(region === selectedRegion ? '' : region)}
              onMouseEnter={e => { if (!isSelected) e.target.setAttribute('fill', '#818cf8'); }}
              onMouseLeave={e => { e.target.setAttribute('fill', isSelected ? '#0d9488' : fill); }}
            />
          );
        })}
      </svg>

      <Tooltip
        id="map-tooltip"
        style={{ fontSize: '0.78rem', borderRadius: '8px', zIndex: 9999 }}
      />

      {/* Color legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Low</span>
        <div style={{
          width: 120, height: 10, borderRadius: 4,
          background: 'linear-gradient(to right, #99f6e4, #115e59)',
        }} />
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>High</span>
        {selectedRegion && (
          <span style={{
            marginLeft: '1rem', fontSize: '0.72rem',
            background: '#ccfbf1', color: '#0d9488',
            padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600,
          }}>
            Active filter: {selectedRegion}
          </span>
        )}
      </div>
    </div>
  );
}
