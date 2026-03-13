export default function MetricCard({ label, value }) {
  return (
    <div
      className="rounded-[7px] border px-3 py-2"
      style={{ borderColor: 'var(--bg-border)', backgroundColor: 'var(--bg-elevated)' }}
    >
      <p className="text-[18px] font-bold tracking-[-0.4px]">{value}</p>
      <p className="label mt-1">{label}</p>
    </div>
  );
}
