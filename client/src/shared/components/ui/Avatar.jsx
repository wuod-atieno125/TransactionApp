export default function Avatar({ name, color = 'green' }) {
  const initials = name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  return <span className={`avatar avatar-${color}`} aria-label={name}>{initials}</span>
}
