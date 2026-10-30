import { useEffect, useSyncExternalStore } from "react";

// A tiny History API router: three pages don't need an extra dependency.
const subscribe = (listener) => {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
};

export const usePathname = () => useSyncExternalStore(subscribe, () => window.location.pathname);

export function navigate(to, { replace = false } = {}) {
  const url = new URL(to, window.location.origin);
  const method = replace ? history.replaceState : history.pushState;
  method.call(history, null, "", url.pathname + url.search + url.hash);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function Link({ to, onClick, ...props }) {
  const handleClick = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handleClick} {...props} />;
}

export function useBodyClass(name) {
  useEffect(() => {
    if (!name) return undefined;
    document.body.classList.add(name);
    return () => document.body.classList.remove(name);
  }, [name]);
}

export function usePageTitle(title) {
  useEffect(() => { document.title = title; }, [title]);
}
