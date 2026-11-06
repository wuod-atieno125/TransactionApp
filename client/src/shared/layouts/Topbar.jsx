import { Bell, Menu, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import ProfileAvatar from '../../modules/members/components/ProfileAvatar.jsx'
import { getUnreadNotificationCount } from '../../modules/notifications/services/notificationService.js'

function displayName(user) {
  return user?.fullName || user?.name || user?.full_name || 'Account'
}

export default function Topbar({
  title,
  user,
  theme,
  onThemeChange,
  onMenuClick,
  onNavigate,
  page,
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const name = displayName(user)

  useEffect(() => {
    let active = true

    async function refreshUnreadCount() {
      try {
        const count = await getUnreadNotificationCount()
        if (active) setUnreadCount(count)
      } catch {
        if (active) setUnreadCount(0)
      }
    }

    refreshUnreadCount()
    const interval = window.setInterval(refreshUnreadCount, 30000)
    window.addEventListener('focus', refreshUnreadCount)
    window.addEventListener('notifications:changed', refreshUnreadCount)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshUnreadCount)
      window.removeEventListener('notifications:changed', refreshUnreadCount)
    }
  }, [page])

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <button
          className="mobile-menu-button"
          type="button"
          aria-label="Open navigation menu"
          aria-controls="app-navigation"
          onClick={onMenuClick}
        >
          <Menu size={20} />
        </button>
        <nav aria-label="Breadcrumb">
          <ol className="breadcrumb">
            <li>Umoja Welfare</li>
            <li aria-current="page">{title}</li>
          </ol>
        </nav>
      </div>
      <div className="topbar-actions">
        <div className="theme-switch" role="group" aria-label="Color theme">
          <button
            className={`theme-toggle${theme === 'light' ? ' active' : ''}`}
            type="button"
            aria-label="Use light mode"
            aria-pressed={theme === 'light'}
            title="Light mode"
            onClick={() => onThemeChange?.('light')}
          >
            <Sun size={18} aria-hidden="true" />
          </button>
          <button
            className={`theme-toggle${theme === 'dark' ? ' active' : ''}`}
            type="button"
            aria-label="Use dark mode"
            aria-pressed={theme === 'dark'}
            title="Dark mode"
            onClick={() => onThemeChange?.('dark')}
          >
            <Moon size={18} aria-hidden="true" />
          </button>
        </div>
        <button
          className="notification-shortcut"
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          title="Notifications"
          onClick={() => onNavigate?.('notifications')}
        >
          <Bell size={19} aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="notification-shortcut-count" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        <span className="topbar-identity">
          <ProfileAvatar
            userId={user?.id}
            name={name}
            profilePictureUpdatedAt={user?.profilePictureUpdatedAt}
          />
          <span>{name}</span>
        </span>
      </div>
    </header>
  )
}
