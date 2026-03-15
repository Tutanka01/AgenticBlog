export default function MetricCard({ label, value, icon: Icon, valueColor }) {
  return (
    <div
      className="glass-card flex items-start justify-between px-4 py-3.5"
    >
      <div>
        <p className="text-[22px] font-extrabold tracking-[-0.8px]" style={{ color: valueColor || 'var(--text-primary)' }}>
          {value}
        </p>
        <p
          className="mt-1 text-[9px] font-medium uppercase"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
        >
          {label}
        </p>
      </div>

      {Icon ? <Icon size={14} style={{ color: 'var(--text-muted)' }} /> : null}
    </div>
  );
}
