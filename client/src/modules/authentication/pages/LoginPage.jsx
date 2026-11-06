
import { useState } from 'react'
import { ArrowRight, LockKeyhole, Smartphone } from 'lucide-react'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordInput from '../../../shared/components/PasswordInput.jsx'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'

export default function LoginPage({ onLogin, onRegister, onForgotPassword, onHome }) {
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useAutoDismiss(error, setError)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await onLogin(username.trim(), phone.trim(), password)
    } catch (err) {
      setError(
        err.message ||
          'Unable to sign in. Check your details and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="WELCOME BACK"
      title="Sign in to your account"
      description="Access your group contributions and account."
      onHome={onHome}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-username">Username</label>
          <span className="auth-input-icon-wrap">
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              value={username}
              onChange={event => setUsername(event.target.value)}
              minLength={3}
              maxLength={30}
              required
            />
          </span>

          <label htmlFor="login-phone">Phone number</label>
          <span className="auth-input-icon-wrap">
            <Smartphone className="auth-input-icon" size={18} aria-hidden="true" />
            <input
              id="login-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="Enter your registered phone number"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              required
            />
          </span>

          <label htmlFor="login-password">Password</label>
          <span className="auth-input-icon-wrap auth-password-icon-wrap">
            <LockKeyhole className="auth-input-icon" size={18} aria-hidden="true" />
            <PasswordInput
              id="login-password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
          </span>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {submitting && <p className="auth-status" role="status">Signing you in…</p>}

          <button
            className="primary-button auth-submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : <>Sign in <ArrowRight size={18} /></>}
          </button>
      </form>

      <p className="auth-footnote auth-forgot-footnote">
        <button
          type="button"
          className="link-button auth-forgot-link"
          onClick={onForgotPassword}
        >
          Forgot your password?
        </button>
      </p>

      <p className="auth-footnote">
        Don't have an account?{' '}
        <button
          type="button"
          className="link-button auth-account-link"
          onClick={onRegister}
        >
          Create an account
        </button>
      </p>

      <p className="auth-footnote">
        Your account access is managed by your group.
      </p>
    </AuthLayout>
  )
}
