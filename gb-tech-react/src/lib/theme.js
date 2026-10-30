import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "./motion.js";

const KEY = "gb-theme";
const root = document.documentElement;
const media = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set();

const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (theme) => { try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ } };

let current = root.dataset.theme || (media.matches ? "dark" : "light");
root.dataset.theme = current;

function apply(theme) {
  current = theme;
  root.dataset.theme = theme;
  listeners.forEach((listener) => listener());
}

// Follow the system setting until the visitor picks a theme themselves
media.addEventListener?.("change", (event) => {
  if (!read()) apply(event.matches ? "dark" : "light");
});

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTheme = () => useSyncExternalStore(subscribe, () => current);

export function toggleTheme(origin) {
  const next = current === "dark" ? "light" : "dark";
  write(next);
  if (prefersReducedMotion()) { apply(next); return; }
  if (!document.startViewTransition) {
    root.classList.add("theme-switching");
    apply(next);
    setTimeout(() => root.classList.remove("theme-switching"), 350);
    return;
  }
  // Circular reveal that grows out of the toggle button
  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(() => apply(next));
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 600, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    })
    .catch(() => {});
}
