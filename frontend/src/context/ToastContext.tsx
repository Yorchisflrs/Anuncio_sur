import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, X } from 'lucide-react';

const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => setMessage(''), 6500); return () => window.clearTimeout(timer); }, [message]);
  return <ToastContext.Provider value={setMessage}>{children}{message && <div className="toast" role="status"><CheckCircle2 size={22}/><span>{message}</span><button aria-label="Cerrar notificación" onClick={() => setMessage('')}><X size={18}/></button></div>}</ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
