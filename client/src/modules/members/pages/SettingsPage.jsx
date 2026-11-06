import { useState } from 'react'
import PageHeader from '../../../shared/components/PageHeader.jsx'
import AccountPage from './AccountPage.jsx'
import ProfilePage from './ProfilePage.jsx'

const sections = [
  { id: 'account', label: 'My Account' },
  { id: 'profile', label: 'Profile' },
]

export default function SettingsPage({ user, onAccountUpdated }) {
  const [activeSection, setActiveSection] = useState('account')

  return (
    <>
      <PageHeader
        eyebrow="PREFERENCES"
        title="Settings"
        description="Manage your account details and review your profile."
      />

      <div className="settings-sections">
        <nav className="settings-section-tabs" aria-label="Settings sections">
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={activeSection === section.id ? 'active' : ''}
              onClick={() => setActiveSection(section.id)}
              aria-current={activeSection === section.id ? 'page' : undefined}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <section aria-label={sections.find(({ id }) => id === activeSection)?.label}>
          {activeSection === 'account' ? (
            <AccountPage
              user={user}
              onAccountUpdated={onAccountUpdated}
              embedded
            />
          ) : (
            <ProfilePage embedded />
          )}
        </section>
      </div>
    </>
  )
}
