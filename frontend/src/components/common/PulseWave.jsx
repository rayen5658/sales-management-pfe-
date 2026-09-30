import { useEffect, useRef } from 'react';

/**
 * A row of bars whose heights continuously oscillate low → high → low in a
 * staggered wave, driven by requestAnimationFrame (not CSS keyframes) so the
 * phase math is explicit and easy to retune. Purely decorative — respects
 * prefers-reduced-motion by freezing at a mid-height instead of animating.
 */
export default function PulseWave({ bars = 7, height = 28, color = '#0d9488', color2 = '#0891b2', speed = 1600, barWidth = 4, gap = 3 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const barEls = Array.from(el.children);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      barEls.forEach(bar => { bar.style.height = `${height * 0.55}px`; });
      return;
    }

    const minH = height * 0.18;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = (now - start) / speed;
      barEls.forEach((bar, i) => {
        const phase = t + i * 0.55;
        const value = (Math.sin(phase) + 1) / 2; // oscillates 0 -> 1 -> 0
        bar.style.height = `${minH + value * (height - minH)}px`;
        bar.style.opacity = 0.55 + value * 0.45;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [height, speed]);

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'flex-end', gap, height, flexShrink: 0 }} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: barWidth,
            height: `${height * 0.4}px`,
            borderRadius: barWidth,
            background: `linear-gradient(180deg, ${color}, ${color2})`,
          }}
        />
      ))}
    </div>
  );
}
