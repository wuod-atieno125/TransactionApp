import { useState } from 'react'
import facebookLogo from '../assets/fb.png'
import emailLogo from '../assets/email.jpeg'
import whatsappLogo from '../assets/whatsapp.png'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

const whatsappMessage =
  'hello it`s haningtone the designer of the Pamoja contribution management group, Any service you need?'

const footerLinks = [
  {
    label: 'WhatsApp',
    href: `https://wa.me/254794358892?text=${encodeURIComponent(whatsappMessage)}`,
    icon: whatsappLogo,
    external: true,
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/profile.php?id=61592740528794',
    icon: facebookLogo,
    external: true,
  },
  {
    label: 'Email',
    href: 'mailto:haningtonemasinde9@gmail.com',
    icon:emailLogo,
    external: true,
  },
]

const titles = {
  dashboard: 'Overview',
  welfareContributions: 'Welfare transaction records',
  members: 'Members',
  approvals: 'Approvals',
  reports: 'Reports',
  settings: 'Settings',
  groupRules: 'Group rules',
  meetings: 'Meetings',
  minutes: 'Meeting minutes',
  notifications: 'Notifications',
  technicalAdmin: 'Technical Administration',
  auditLog: 'Audit Log Report',
}

export default function AppLayout({
  page,
  user,
  theme,
  onThemeChange,
  onNavigate,
  onLogout,
  loggingOut = false,
  children,
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="app-shell" data-theme={theme} data-page={page}>
      {mobileNavOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <Sidebar
        page={page}
        user={user}
        onLogout={onLogout}
        loggingOut={loggingOut}
        onNavigate={onNavigate}
        onClose={() => setMobileNavOpen(false)}
        mobileOpen={mobileNavOpen}
      />
      <main className="main-area">
        <Topbar
          title={titles[page] || 'Workspace'}
          user={user}
          theme={theme}
          onThemeChange={onThemeChange}
          onNavigate={onNavigate}
          page={page}
          onMenuClick={() => setMobileNavOpen(open => !open)}
        />
        <div className="page-content" id="main-content">
          {children}
          <footer className="app-footer app-footer--centered">
            <div className="app-footer__credits">
              <span>Copyright © {new Date().getFullYear()} Wuod Atieno</span>
              <span>Designed and developed by Haningtone Omondi</span>
            </div>
            <nav
              className="app-footer__links app-footer__social-links"
              aria-label="Contact and social links"
            >
              {footerLinks.map(({ label, href, icon, external }) => (
                <a
                  className={`app-footer__link app-footer__link--${label.toLowerCase()}`}
                  href={href}
                  key={label}
                  aria-label={label}
                  title={label}
                  {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
                >
                  <img src={icon} alt="" aria-hidden="true" />
                </a>
              ))}
            </nav>
          </footer>
        </div>
      </main>
    </div>
  )
}
