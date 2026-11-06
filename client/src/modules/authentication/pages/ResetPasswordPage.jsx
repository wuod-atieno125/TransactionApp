import { useState } from 'react'
import AuthLayout from '../components/AuthLayout.jsx'
import { verifyPasswordResetCode } from '../services/authService.js'

export default function ResetPasswordPage({
  email,
  onLogin,
  onForgotPassword,
  onHome,
  onCodeVerified,
}) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleVerifyCode(event) {
    event.preventDefault()
    setError('')

    if (!email) {
      setError('Your recovery email is missing. Please request a new code.')
      return
    }

    if (!/^\d{6}$/.test(code)) {
      setError('Enter the complete six-digit verification code.')
      return
    }

    setSubmitting(true)

    try {
      await verifyPasswordResetCode(email, code)

      // Move to the separate new-password page only after verification.
      onCodeVerified(code)
    } catch (requestError) {
      setError(
        requestError.message ||
          'Invalid or expired verification code. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="ACCOUNT RECOVERY"
      title="Verify your reset code"
      description="Enter the six-digit verification code sent to your recovery email. The code expires after five minutes."
      onHome={onHome}
    >
      <form className="auth-form" onSubmit={handleVerifyCode}>
        <label htmlFor="reset-code">Six-digit verification code</label>

        <input
          id="reset-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter the six-digit code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            setError('')
          }}
          pattern="[0-9]{6}"
          maxLength={6}
          autoFocus
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
          disabled={submitting || code.length !== 6 || !email}
        >
          {submitting ? 'Verifying code…' : 'Verify code'}
        </button>
      </form>

      <p className="auth-footnote">
        Need a new code?{' '}
        <button
          type="button"
          className="link-button"
          onClick={onForgotPassword}
        >
          Request another code
        </button>
        {' · '}
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