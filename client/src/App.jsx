import { useEffect, useState } from 'react'
import AppLayout from './layouts/AppLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import TransactionsPage from './pages/TransactionsPage.jsx'
import MembersPage from './pages/MembersPage.jsx'
import ApprovalsPage from './pages/ApprovalsPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import SetNewPasswordPage from './pages/SetPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import { getCurrentUser, login, logout } from './services/authService.js'
import './App.css'
import './app-theme.css'
import GroupRulesPage from './pages/GroupRulesPage.jsx'
import MeetingsPage from './pages/MeetingsPage.jsx'
import MeetingMinutesPage from './pages/MeetingMinutesPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import TechnicalAdminPage from './pages/TechnicalAdminPage.jsx'
import AuditLogPage from './pages/AuditLogPage.jsx'
import SessionTimeout from './components/SessionTimeout.jsx'
import useAutoDismiss from './hooks/useAutoDismiss.js'

const pageComponents = {
  dashboard: DashboardPage,
  transactions: TransactionsPage,
  members: MembersPage,
  approvals: ApprovalsPage,
  reports: ReportsPage,
  account: AccountPage,
  groupRules: GroupRulesPage,
  meetings: MeetingsPage,
  minutes: MeetingMinutesPage,
  notifications: NotificationsPage,
  profile: ProfilePage,
  technicalAdmin: TechnicalAdminPage,
  auditLog: AuditLogPage,
}

function defaultPageFor() {
  return 'dashboard'
}

export default function App() {
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem('gather-theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const [page, setPage] = useState('dashboard')
  const [checkingSession, setCheckingSession] = useState(true)
  const [appError, setAppError] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [verifiedRecoveryCode, setVerifiedRecoveryCode] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [authPage, setAuthPage] = useState('landing')
  useAutoDismiss(appError, setAppError)

  useEffect(() => {
    let active = true

    getCurrentUser()
      .then(currentUser => {
        if (!active) return
        setUser(currentUser)
        setPage(defaultPageFor(currentUser))
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setCheckingSession(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function handleLogin(username, phone, password) {
    const signedInUser = await login(username, phone, password)
    setUser(signedInUser)
    setPage(defaultPageFor(signedInUser))
    setAppError('')
  }

  async function handleLogout() {
    setAppError('')
    setLoggingOut(true)

    try {
      await logout()
      setUser(null)
      setPage('dashboard')
      setAuthPage('landing')
    } catch (error) {
      setAppError(error.message || 'Unable to sign out. Please try again.')
    } finally {
      setLoggingOut(false)
    }
  }

  async function handleExtendSession() {
    try {
      const currentUser = await getCurrentUser()
      setUser(currentUser)
      return true
    } catch (error) {
      if (error.status === 401) {
        setUser(null)
        setPage('dashboard')
        setAuthPage('login')
        return false
      }
      throw error
    }
  }

  function handleSessionExpired() {
    setUser(null)
    setPage('dashboard')
    setAuthPage('login')
  }

  function handleAccountUpdated(account) {
    setUser(current => ({
      ...current,
      fullName: account.fullName,
      phone: account.phone,
      recoveryEmail: account.recoveryEmail,
      profilePictureUpdatedAt: account.profilePictureUpdatedAt,
    }))
  }

  function handleThemeToggle() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    try {
      window.localStorage.setItem('gather-theme', nextTheme)
    } catch {
      // Keep the current session toggle working when storage is unavailable.
    }
  }

  function showLogin() {
    setAuthPage('login')
    if (window.location.pathname.replace(/\/$/, '') === '/reset-password') {
      window.history.replaceState({}, '', '/')
    }
  }

  function showHome() {
    setAuthPage('landing')
    if (window.location.pathname.replace(/\/$/, '') === '/reset-password') {
      window.history.replaceState({}, '', '/')
    }
  }

  if (checkingSession) {
    return (
      <main className="auth-loading" aria-live="polite">
        <span className="brand-mark">p</span>
        <p>Checking your session…</p>
      </main>
    )
  }

  if (!user) {
    if (authPage === 'landing') {
      return (
        <LandingPage
          onLogin={() => setAuthPage('login')}
          onRegister={() => setAuthPage('register')}
        />
      )
    }

    if (authPage === 'register') {
      return (
        <RegisterPage
          onLogin={() => setAuthPage('login')}
          onHome={() => setAuthPage('landing')}
        />
      )
    }
    if (authPage === 'forgot-password') {
  return (
    <ForgotPasswordPage
      onLogin={showLogin}
      onHome={showHome}
      onResetPassword={(email) => {
        setRecoveryEmail(email.trim().toLowerCase())
        setVerifiedRecoveryCode('')
        setAuthPage('reset-password')
      }}
    />
  )
}

if (authPage === 'reset-password') {
  return (
    <ResetPasswordPage
      email={recoveryEmail}
      onLogin={showLogin}
      onForgotPassword={() => setAuthPage('forgot-password')}
      onHome={showHome}
      onCodeVerified={(code) => {
        setVerifiedRecoveryCode(code)
        setAuthPage('set-new-password')
      }}
    />
  )
}

if (authPage === 'set-new-password') {
  return (
    <SetNewPasswordPage
      email={recoveryEmail}
      code={verifiedRecoveryCode}
      onLogin={showLogin}
      onHome={showHome}
    />
  )
}
    return (
      <LoginPage
        onLogin={handleLogin}
        onRegister={() => setAuthPage('register')}
        onForgotPassword={() => setAuthPage('forgot-password')}
        onHome={() => setAuthPage('landing')}
      />
    )
  }

  const role = String(user.role || '').toLowerCase().replace(/\s+/g, '')

  const permittedPages = {
    member: [
      'dashboard', 'transactions', 'members', 'groupRules',
      'meetings', 'minutes', 'notifications', 'account', 'profile',
    ],
    treasurer: [
      'dashboard', 'transactions', 'members', 'reports', 'groupRules',
      'meetings', 'minutes', 'notifications', 'account', 'profile',
    ],
    chairperson: [
      'dashboard', 'transactions', 'members', 'approvals', 'reports',
      'groupRules', 'meetings', 'minutes', 'notifications', 'account', 'profile',
    ],
    secretary: [
      'dashboard', 'transactions', 'members', 'groupRules', 'meetings', 'minutes',
      'notifications', 'account', 'profile',
    ],
    technical_admin: [
      'technicalAdmin', 'auditLog', 'notifications', 'account', 'profile',
    ],
  }

  const allowedPages = permittedPages[role] || ['account']
  const safePage = allowedPages.includes(page) ? page : allowedPages[0]
  const Page = pageComponents[safePage] || AccountPage

  return (
    <AppLayout
      page={safePage}
      user={user}
      theme={theme}
      onThemeToggle={handleThemeToggle}
      onNavigate={setPage}
      onLogout={handleLogout}
      loggingOut={loggingOut}
    >
      {appError && (
        <p className="app-error app-feedback-toast" role="alert">
          {appError}
        </p>
      )}
      <Page
        user={user}
        onNavigate={setPage}
        onAccountUpdated={handleAccountUpdated}
      />
      <SessionTimeout
        userId={user.id}
        onExtend={handleExtendSession}
        onLogout={handleLogout}
        loggingOut={loggingOut}
        onExpire={handleSessionExpired}
      />
    </AppLayout>
  )
}
