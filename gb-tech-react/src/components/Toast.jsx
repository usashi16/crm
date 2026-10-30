import { createContext, useCallback, useContext, useRef, useState } from "react";

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const show = useCallback((message, type = "success") => {
    const id = ++nextId.current;
    setToasts((list) => [...list, { id, message, type, leaving: false }]);
    setTimeout(() => setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t))), 3600);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3900);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}${t.leaving ? " is-leaving" : ""}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
