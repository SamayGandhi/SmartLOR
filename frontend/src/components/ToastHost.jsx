import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export function showToast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('smartlor:toast', { detail: { message, type } }));
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    const handler = (event) => {
      const id = `${Date.now()}-${Math.random()}`;
      const item = { id, ...event.detail };
      setToasts(prev => [...prev.slice(-3), item]);
      window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
    };
    window.addEventListener('smartlor:toast', handler);
    return () => window.removeEventListener('smartlor:toast', handler);
  }, []);
  return <div className="toast-stack" aria-live="polite">{toasts.map(toast => {
    const Icon = toast.type === 'error' ? AlertCircle : toast.type === 'info' ? Info : CheckCircle2;
    return <div className={`toast ${toast.type}`} key={toast.id}><Icon size={18}/><span>{toast.message}</span><button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} aria-label="Dismiss"><X size={15}/></button></div>;
  })}</div>;
}
