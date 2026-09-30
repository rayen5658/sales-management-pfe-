import React from 'react';

// Utility component (optional for debugging). Kept minimal to avoid impacting UI.
export default function ScreenContextOverlay({ data }) {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: 'rgba(15,23,42,0.92)',
        color: '#fff',
        padding: 12,
        borderRadius: 10,
        zIndex: 9999,
        maxWidth: 320,
        fontSize: 12,
        lineHeight: 1.35,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Chat context</div>
      {Object.entries(data)
        .slice(0, 8)
        .map(([k, v]) => (
          <div key={k} style={{ opacity: 0.95 }}>
            <span style={{ color: '#93c5fd', fontWeight: 700 }}>{k}:</span> {String(v)}
          </div>
        ))}
    </div>
  );
}

