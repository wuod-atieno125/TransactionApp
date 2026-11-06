import { useState } from 'react'
import AuthLayout from '../components/AuthLayout.jsx'
import { requestPasswordReset } from '../services/authService.js'

export default function ForgotPasswordPage({
  onLogin,
  onHome,
  onResetPassword,
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Please enter your registered recovery email.')
      return
    }

    setSubmitting(true)

    try {
      await requestPasswordReset(normalizedEmail)

      // Carry the email to the separate verification page.
      if (onResetPassword) {
        onResetPassword(normalizedEmail)
      }
    } catch (requestError) {
      setError(
        requestError.message ||
          'Unable to request a password reset code. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="ACCOUNT RECOVERY"
      title="Forgot your password?"
      description="Enter the recovery email saved on your account. If an account matches, a six-digit verification code will be sent. The code expires after five minutes."
      onHome={onHome}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="recovery-email">Recovery email</label>

        <input
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Enter your registered email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          required
        />

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="primary-button auth-submit"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Sending code…' : 'Send verification code'}
        </button>
      </form>

      <p className="auth-footnote">
        Remember your password?{' '}
        <button
          type="button"
          className="link-button"
          onClick={onLogin}
        >
          Return to sign in
        </button>
      </p>
    </AuthLayout>
  )
}