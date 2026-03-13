export default function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-[5px] border px-2 py-0.5 text-[10px] font-medium ${className}`}
      style={{ borderColor: 'var(--bg-border)' }}
    >
      {children}
    </span>
  );
}
