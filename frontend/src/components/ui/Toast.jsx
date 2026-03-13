export default function Toast({ toast, onClose }) {
  const bg = {
    success: 'rgba(34,197,94,0.12)',
    error: 'rgba(239,68,68,0.12)',
    info: 'rgba(139,92,246,0.12)',
  }[toast.type || 'info'];

  const color = {
    success: 'var(--accent-green)',
    error: 'var(--accent-red)',
    info: 'var(--accent-purple)',
  }[toast.type || 'info'];

  return (
    <div
      className="mb-2 min-w-[220px] rounded-md border px-3 py-2 text-sm"
      style={{
        backgroundColor: bg,
        borderColor: color,
        animation: 'slideInBottom 0.2s ease-out',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span style={{ color: 'var(--text-primary)' }}>{toast.message}</span>
        <button className="text-xs" style={{ color }} onClick={() => onClose(toast.id)}>
          close
        </button>
      </div>
    </div>
  );
}
