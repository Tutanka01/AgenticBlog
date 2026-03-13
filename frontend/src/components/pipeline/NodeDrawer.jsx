import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function NodeDrawer({ open, node, state, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!open || !node) {
    return null;
  }

  return (
    <>
      <button
        className="fixed inset-0 z-20 bg-black/40"
        onClick={onClose}
        aria-label="Close drawer backdrop"
      />
      <aside
        className="fixed right-0 top-0 z-30 h-full w-[360px] border-l p-4 transition duration-150"
        style={{
          borderColor: 'var(--bg-border)',
          backgroundColor: 'var(--bg-surface)',
          transform: 'translateX(0)',
          animation: 'slideInRight 0.18s ease-out',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold tracking-[-0.4px]">{node}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              {state?.status || 'idle'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border p-1"
            style={{ borderColor: 'var(--bg-border)' }}
          >
            <X size={14} />
          </button>
        </div>

        <div
          className="h-[calc(100%-56px)] overflow-auto rounded-md border p-3"
          style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-base)' }}
        >
          <pre className="mono text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {JSON.stringify(state || {}, null, 2)}
          </pre>
        </div>
      </aside>
    </>
  );
}
