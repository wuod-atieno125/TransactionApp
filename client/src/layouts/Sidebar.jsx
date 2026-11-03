import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  UserCheck,
  ChartNoAxesCombined,
  FileText,
  CalendarDays,
  ClipboardList,
  Bell,
  ContactRound,
  Wallet,
  ShieldCheck,
  ClipboardCheck,
  LogOut,
} from 'lucide-react'
import ProfileAvatar from '../components/ProfileAvatar.jsx'

const navigationItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'approvals', label: 'Member Approvals', icon: UserCheck },
  { key: 'reports', label: 'Reports', icon: ChartNoAxesCombined },
  { key: 'groupRules', label: 'Group Rules', icon: FileText },
  { key: 'meetings', label: 'Meetings', icon: CalendarDays },
  { key: 'minutes', label: 'Meeting Minutes', icon: ClipboardList },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'technicalAdmin', label: 'Technical Administration', icon: ShieldCheck },
  { key: 'auditLog', label: 'Audit Log Report', icon: ClipboardCheck },
  { key: 'account', label: 'My Account', icon: Wallet },
  { key: 'profile', label: 'Profile', icon: ContactRound },
]

const roleNavigation = {
  member: [
    'dashboard',
    'transactions',
    'members',
    'groupRules',
    'meetings',
    'minutes',
    'notifications',
    'account',
    'profile',
  ],
  treasurer: [
    'dashboard',
    'transactions',
    'members',
    'reports',
    'groupRules',
    'meetings',
    'minutes',
    'notifications',
    'account',
    'profile',
  ],
  chairperson: [
    'dashboard',
    'transactions',
    'members',
    'approvals',
    'reports',
    'groupRules',
    'meetings',
    'minutes',
    'notifications',
    'account',
    'profile',
  ],
  secretary: [
    'dashboard',
    'transactions',
    'members',
    'groupRules',
    'meetings',
    'minutes',
    'notifications',
    'account',
    'profile',
  ],
  technical_admin: [
    'technicalAdmin',
    'auditLog',
    'notifications',
    'account',
    'profile',
  ],
}

export default function Sidebar({
  page,
  onNavigate,
  user,
  role,
  onLogout,
  loggingOut = false,
  onClose,
  mobileOpen = false,
}) {
  const userRole = String(role || user?.role || 'member')
    .toLowerCase()
    .replace(/\s+/g, '')

  const allowedItems =
    roleNavigation[userRole] || roleNavigation.member

  const visibleItems = navigationItems.filter((item) =>
    allowedItems.includes(item.key),
  )
  const displayName = user?.fullName || user?.full_name || user?.name || 'Account'
  const displayRole = String(user?.role || 'member').replace(/([A-Z])/g, ' $1')

  return (
    <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
      <a className="sidebar-brand" href="#main-content" onClick={onClose}>
        <span className="sidebar-brand-icon"><Wallet size={21} /></span>
        <span className="sidebar-brand-text">
          <strong>Pamoja<span>.</span></strong>
          <small>Umoja Welfare</small>
        </span>
      </a>

      <div className="technical-admin-group-card">
        <span>YOUR GROUP</span>
        <strong>Umoja Welfare</strong>
      </div>

      <nav id="app-navigation" className="sidebar-navigation" aria-label="Main navigation">
        <p className="sidebar-section-title">MAIN MENU</p>
        <ul>
          {visibleItems.map((item) => {
            const Icon = item.icon
            const active = page === item.key

            return (
              <li key={item.key}>
                <button
                  type="button"
                  className={`sidebar-nav-item${active ? ' active' : ''}`}
                  onClick={() => {
                    onNavigate?.(item.key)
                    onClose?.()
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <ProfileAvatar
            userId={user?.id}
            name={displayName}
            profilePictureUpdatedAt={user?.profilePictureUpdatedAt}
          />
          <span className="sidebar-user-copy">
            <strong>{displayName}</strong>
            <small>{displayRole}</small>
          </span>
        </div>
        <button
          className="sidebar-logout-button"
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          aria-live="polite"
        >
          <LogOut size={17} strokeWidth={1.8} />
          <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
        </button>
      </div>
    </aside>
  )
}
