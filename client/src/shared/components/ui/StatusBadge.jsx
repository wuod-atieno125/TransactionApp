export default function StatusBadge({ children = 'Active', tone = 'success' }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>
}
