/**
 * AppLogo — Dynamix Services brand mark
 * Props:
 *   size        — height in px of the cube icon (default 36)
 *   showText    — show "Dynamix services" wordmark (default true)
 *   inverted    — white wordmark for dark backgrounds (default false)
 *   compact     — tighter sizing (default false)
 */
export default function AppLogo({ size = 36, showText = true, inverted = false, compact = false }) {
  const cubeSize = size;
  const titleSize = compact ? Math.round(cubeSize * 0.52) : Math.round(cubeSize * 0.6);
  const subSize   = compact ? Math.round(cubeSize * 0.38) : Math.round(cubeSize * 0.42);

  const titleColor = inverted ? '#fff'    : '#2d2580';   // deep purple
  const subColor   = inverted ? '#ff6b6b' : '#cc1a2e';   // vivid red

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(cubeSize * 0.35), userSelect: 'none', lineHeight: 1 }}>

      {/* ── Cube mark ── */}
      <svg
        width={cubeSize}
        height={cubeSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <defs>
          {/* Drop shadow filter */}
          <filter id="cube-shadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#00000033" />
          </filter>

          {/* Face gradients */}
          <linearGradient id="g-green" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#6dd832" />
            <stop offset="100%" stopColor="#3aa810" />
          </linearGradient>
          <linearGradient id="g-blue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#4eb8e8" />
            <stop offset="100%" stopColor="#1a7ec8" />
          </linearGradient>
          <linearGradient id="g-red" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#e8403a" />
            <stop offset="100%" stopColor="#b01c18" />
          </linearGradient>
          <linearGradient id="g-orange" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#f5a623" />
            <stop offset="100%" stopColor="#d4750a" />
          </linearGradient>
          <linearGradient id="g-purple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#7c6de0" />
            <stop offset="100%" stopColor="#4a3ab0" />
          </linearGradient>
        </defs>

        {/*
          The Dynamix logo is essentially two overlapping 3-D cubes shown in isometric-ish style.
          Left cube:  green (front-left), blue (top), orange (bottom-right sliver)
          Right cube: blue (top), red (front-right), purple-blue (back-left)
          We approximate with layered polygons.
        */}

        {/* ── LEFT CUBE ── */}
        {/* Green face — front left */}
        <polygon points="12,42 42,24 42,62 12,80" fill="url(#g-green)" filter="url(#cube-shadow)" />
        {/* Blue face — top left */}
        <polygon points="12,42 42,24 64,34 34,52" fill="url(#g-blue)" />
        {/* Orange face — bottom/right of left cube */}
        <polygon points="42,62 42,24 64,34 64,72" fill="url(#g-orange)" />

        {/* ── RIGHT CUBE (overlapping, slightly offset up-right) ── */}
        {/* Purple/blue face — back left of right cube */}
        <polygon points="34,22 62,6  62,44 34,60" fill="url(#g-purple)" />
        {/* Blue/light face — top of right cube */}
        <polygon points="34,22 62,6  84,16 56,32" fill="url(#g-blue)" />
        {/* Red face — front right */}
        <polygon points="62,6  84,16 84,54 62,44" fill="url(#g-red)" />

        {/* Subtle drop shadow ellipse at base */}
        <ellipse cx="48" cy="88" rx="28" ry="5" fill="rgba(0,0,0,0.12)" />
      </svg>

      {/* ── Wordmark ── */}
      {showText && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}>
          {/* "Dynamix" — bold, rounded, purple */}
          <span style={{
            fontSize: titleSize,
            fontWeight: 900,
            color: titleColor,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            fontFamily: '"Nunito", "Varela Round", "Trebuchet MS", system-ui, sans-serif',
            whiteSpace: 'nowrap',
          }}>
            Dynamix
          </span>
          {/* "services" — lighter, spaced, red */}
          <span style={{
            fontSize: subSize,
            fontWeight: 700,
            color: subColor,
            letterSpacing: '0.12em',
            textTransform: 'lowercase',
            lineHeight: 1,
            fontFamily: '"Nunito", "Varela Round", "Trebuchet MS", system-ui, sans-serif',
            whiteSpace: 'nowrap',
          }}>
            services
          </span>
        </div>
      )}
    </div>
  );
}
