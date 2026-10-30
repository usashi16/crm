export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const motionAllowed = () => !prefersReducedMotion() && "IntersectionObserver" in window;
export const cx = (...parts) => parts.filter(Boolean).join(" ");

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// Calls onFrame(value) every frame from `from` to `to`. Returns a cancel function.
export function tween(from, to, duration, onFrame) {
  const start = performance.now();
  let id = 0;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    onFrame(from + (to - from) * easeOutCubic(t));
    if (t < 1) id = requestAnimationFrame(step);
  };
  id = requestAnimationFrame(step);
  return () => cancelAnimationFrame(id);
}
