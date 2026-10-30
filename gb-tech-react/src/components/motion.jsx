import { useEffect, useRef, useState } from "react";
import { cx, motionAllowed, prefersReducedMotion, tween } from "../lib/motion.js";

// Fades an element in once as it scrolls into view. Hover transforms keep working afterwards.
export function Reveal({ as: Tag = "div", delay = 0, className, style, children, ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const animate = motionAllowed();

  useEffect(() => {
    if (!animate) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [animate]);

  return (
    <Tag
      ref={ref}
      className={cx(className, visible && "is-visible")}
      data-reveal={animate ? "" : undefined}
      style={{ "--reveal-delay": `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// Counts text like "120+", "96%" or "5.0/5" up from zero when it scrolls into view.
export function CountUp({ text, delay = 0 }) {
  const match = text.match(/^(\d+(?:\.\d+)?)(.*)$/);
  const animatable = Boolean(match) && !/^\d+\/\d+$/.test(text) && motionAllowed();
  const decimals = match ? (match[1].split(".")[1] || "").length : 0;
  const suffix = match ? match[2] : "";
  const target = match ? Number(match[1]) : 0;
  const [display, setDisplay] = useState(animatable ? (0).toFixed(decimals) + suffix : text);
  const ref = useRef(null);

  useEffect(() => {
    if (!animatable) return undefined;
    let cancel = () => {};
    let timer = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      timer = setTimeout(() => {
        cancel = tween(0, target, 1400, (value) => setDisplay(value.toFixed(decimals) + suffix));
      }, delay);
    }, { threshold: 0.4 });
    observer.observe(ref.current);
    return () => { observer.disconnect(); clearTimeout(timer); cancel(); };
  }, [animatable, target, decimals, suffix, delay]);

  return <span ref={ref}>{display}</span>;
}

// Animates from the last shown number to the new value whenever `value` changes.
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 900 }) {
  const shown = useRef(value);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const from = shown.current;
    if (prefersReducedMotion() || from === value) {
      shown.current = value;
      setDisplay(value);
      return undefined;
    }
    return tween(from, value, duration, (next) => {
      shown.current = next;
      setDisplay(next);
    });
  }, [value, duration]);

  return <>{format(display)}</>;
}
