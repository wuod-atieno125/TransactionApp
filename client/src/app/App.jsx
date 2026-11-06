import { useEffect, useState } from 'react'
import AppLayout from '../shared/layouts/AppLayout.jsx'
import LoginPage from '../modules/authentication/pages/LoginPage.jsx'
import ForgotPasswordPage from '../modules/authentication/pages/ForgotPasswordPage.jsx'
import SetNewPasswordPage from '../modules/authentication/pages/SetPasswordPage.jsx'
import ResetPasswordPage from '../modules/authentication/pages/ResetPasswordPage.jsx'
import { getCurrentUser, login, logout } from '../modules/authentication/services/authService.js'
import '../shared/styles/App.css'
import '../shared/styles/app-theme.css'
import RegisterPage from '../modules/authentication/pages/RegisterPage.jsx'
import LandingPage from '../modules/authentication/pages/LandingPage.jsx'
import SessionTimeout from '../shared/components/SessionTimeout.jsx'
import useAutoDismiss from '../shared/hooks/useAutoDismiss.js'
import { moduleRegistry } from './moduleRegistry.js'
import { defaultPage, defaultPageFor } from './navigation/index.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem('gather-theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const [page, setPage] = useState(defaultPage)
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

  function handleThemeChange(nextTheme) {
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
      <main className="auth-loading" aria-live="polite" aria-busy="true">
        <div className="auth-loading__mark" aria-hidden="true">p</div>
        <div className="auth-loading__copy">
          <strong>Preparing your workspace</strong>
          <span>One moment while we get things ready.</span>
        </div>
        <span className="auth-loading__spinner" aria-hidden="true" />
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
      'dashboard', 'welfareContributions', 'members', 'groupRules',
      'meetings', 'minutes', 'notifications', 'settings','fines',
    ],
    treasurer: [
      'dashboard', 'welfareContributions', 'members', 'reports', 'groupRules',
      'meetings', 'minutes', 'notifications', 'settings','fines',
    ],
    chairperson: [
      'dashboard', 'welfareContributions', 'members', 'approvals', 'reports',
      'groupRules', 'meetings', 'minutes', 'notifications', 'settings','fines',
    ],
    secretary: [
      'dashboard', 'welfareContributions', 'members', 'groupRules', 'meetings', 'minutes',
      'fines',
      'notifications', 'settings',
    ],
    technical_admin: [
      'technicalAdmin', 'auditLog', 'notifications', 'settings',
    ],
  }

  const allowedPages = permittedPages[role] || ['settings']
  const requestedPage = page === 'account' || page === 'profile' ? 'settings' : page
  const safePage = allowedPages.includes(requestedPage)
    ? requestedPage
    : allowedPages[0]
  const Page = moduleRegistry[safePage] || moduleRegistry.settings

  return (
    <AppLayout
      page={safePage}
      user={user}
      theme={theme}
      onThemeChange={handleThemeChange}
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
