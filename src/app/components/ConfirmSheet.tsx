import { useEffect, useState } from 'react';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmRequest = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

let requestConfirmFn: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

export function requestConfirm(options: ConfirmOptions) {
  if (!requestConfirmFn) return Promise.resolve(false);
  return requestConfirmFn(options);
}

export default function ConfirmSheet() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    requestConfirmFn = (options) =>
      new Promise<boolean>((resolve) => {
        setRequest({ ...options, resolve });
      });

    return () => {
      requestConfirmFn = null;
    };
  }, []);

  const close = (value: boolean) => {
    if (!request) return;
    request.resolve(value);
    setRequest(null);
  };

  if (!request) return null;

  return (
    <div className="fixed inset-0 z-[250] bg-black/50 backdrop-blur-sm flex items-end justify-center p-4" onClick={() => close(false)}>
      <div
        className="w-full max-w-md rounded-[var(--r-lg)] border border-[var(--border2)] p-5 dayflow-confirm-sheet"
        style={{ background: 'var(--surface3)', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[14px] font-medium mb-1">{request.title}</p>
        <p className="text-[13px] text-[var(--muted2)] mb-4 leading-relaxed">{request.message}</p>
        <div className="flex gap-3">
          <button
            onClick={() => close(false)}
            className="flex-1 py-2.5 px-4 rounded-[var(--r)] border border-[var(--border2)] bg-[var(--surface2)] text-[var(--text)] text-[14px] font-medium"
          >
            {request.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={() => close(true)}
            className={`flex-1 py-2.5 px-4 rounded-[var(--r)] text-[14px] font-medium ${
              request.danger
                ? 'bg-[var(--danger)] text-white'
                : 'bg-[var(--accent)] text-[var(--bg)]'
            }`}
          >
            {request.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
