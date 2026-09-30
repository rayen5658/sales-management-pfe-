import { useRef, useState } from 'react';

/**
 * Tilt3DCard — wraps children in a card that tilts toward the cursor in 3D
 * and shows a soft light-glare that follows the pointer.
 *
 * Props:
 *   className  — forwarded to the outer div
 *   style      — forwarded to the outer div
 *   intensity  — max tilt angle in degrees (default 12)
 *   glareMax   — max glare opacity 0–1 (default 0.45)
 */
export default function Tilt3DCard({
  children,
  className = '',
  style = {},
  intensity = 12,
  glareMax = 0.45,
}) {
  const ref = useRef(null);
  const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = [
      'perspective(700px)',
      `rotateY(${x * intensity}deg)`,
      `rotateX(${-y * intensity}deg)`,
      'translateY(-4px)',
      'scale3d(1.02,1.02,1.02)',
    ].join(' ');
    setGlare({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      opacity: 1,
    });
  };

  const handleMouseLeave = () => {
    if (ref.current) ref.current.style.transform = '';
    setGlare((g) => ({ ...g, opacity: 0 }));
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        position: 'relative',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.18s ease-out, box-shadow 0.18s ease-out',
        willChange: 'transform',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {/* Cursor-tracked glare overlay */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          pointerEvents: 'none',
          background: `radial-gradient(circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.38), transparent 55%)`,
          opacity: glare.opacity * glareMax,
          transition: 'opacity 0.25s ease',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}
