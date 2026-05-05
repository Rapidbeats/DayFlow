import { useEffect, useState } from 'react';

let showToastFn: (message: string, duration?: number) => void;

export function useToast() {
  return {
    showToast: (message: string, duration?: number) => {
      if (showToastFn) showToastFn(message, duration);
    },
  };
}

export default function Toast() {
  const [message, setMessage] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    showToastFn = (msg: string, duration = 2200) => {
      setMessage(msg);
      setIsVisible(true);
      setTimeout(() => {
        setIsVisible(false);
      }, duration);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full border border-[var(--border)] z-[200] animate-in fade-in slide-in-from-bottom-2"
      style={{
        background: 'var(--surface)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <div className="text-[14px] text-[var(--text)] font-medium">{message}</div>
    </div>
  );
}
