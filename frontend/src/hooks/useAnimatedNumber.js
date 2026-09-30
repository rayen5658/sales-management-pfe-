import { useState, useEffect, useRef } from 'react';

/**
 * Smoothly animates a numeric value toward `target` using ease-out cubic.
 * Restarts the animation every time `target` changes.
 *
 * @param {number} target   - The value to animate toward
 * @param {number} duration - Animation duration in ms (default 900)
 * @returns {number}        - Current animated value
 */
export function useAnimatedNumber(target, duration = 900) {
  const [value, setValue] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);
  const rafRef  = useRef(null);

  useEffect(() => {
    if (target === undefined || target === null) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const from  = fromRef.current;
    const start = performance.now();

    const tick = (now) => {
      const t      = Math.min(1, (now - start) / duration);
      const eased  = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(from + (target - from) * eased);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
        rafRef.current  = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}
