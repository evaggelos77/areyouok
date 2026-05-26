import React, { createContext, useContext, useMemo, useState } from 'react';

type ToastCtx = {
  show: (msg: string) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);

  const show = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(null), 2400);
  };

  const value = useMemo(() => ({ show }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {msg ? <div className="toast">{msg}</div> : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('ToastProvider missing');
  return ctx;
}
