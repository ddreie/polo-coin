import { useEffect, useState, type ReactNode } from 'react';

interface ToastItem { id: number; title: string; body?: ReactNode; tone: 'ok' | 'error' }
let push: (t: Omit<ToastItem, 'id'>) => void = () => undefined;
let nextId = 1;

export const toast = {
  ok: (title: string, body?: ReactNode) => push({ title, body, tone: 'ok' }),
  error: (title: string, body?: ReactNode) => push({ title, body, tone: 'error' }),
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    push = (t) => {
      const id = nextId++;
      setItems((xs) => [...xs.slice(-1), { ...t, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.tone === 'error' ? 7000 : 6000);
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <strong>{t.title}</strong>
          {t.body && <div className="toast-body">{t.body}</div>}
          <button className="toast-x" aria-label="Dismiss" onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}>×</button>
        </div>
      ))}
    </div>
  );
}
