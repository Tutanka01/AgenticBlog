export default function Toast({ toast, onClose }) {
  const type = toast.type || 'info';

  const accent = {
    success: '#22C55E',
    error: '#EF4444',
    info: '#8B5CF6',
  }[type];

  return (
    <div
      className="toast-card relative overflow-hidden rounded-md border px-3 py-2 text-sm"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--bg-border)',
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span style={{ color: 'var(--text-primary)' }}>{toast.message}</span>
        <button className="text-xs" style={{ color: 'var(--text-secondary)' }} onClick={() => onClose(toast.id)}>
          x
        </button>
      </div>

      <div
        className="absolute bottom-0 left-0 h-[2px] w-full"
        style={{ backgroundColor: accent, animation: 'toastProgress 3s linear forwards', transformOrigin: 'left center' }}
      />
    </div>
  );
}
