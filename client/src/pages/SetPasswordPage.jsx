import { useState } from 'react'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import { resetPassword } from '../services/authService.js'

export default function SetNewPasswordPage({
  email,
  code,
  onLogin,
  onHome,
}) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!email || !code) {
      setError(
        'Your verification session is missing. Please request a new code.'
      )
      return
    }

    const normalizedUsername = username.trim().toLowerCase()
    if (
      normalizedUsername &&
      !/^[a-z0-9_]{3,30}$/.test(normalizedUsername)
    ) {
      setError('Username must be 3 to 30 characters using letters, numbers, or underscores.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8 || password.length > 40) {
      setError('Your password must be between 8 and 40 characters.')
      return
    }

    if (
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      setError(
        'Use at least one letter, one number, and one special character.'
      )
      return
    }

    setSubmitting(true)

    try {
      await resetPassword(email, code, password, normalizedUsername)
      setSuccess(true)
    } catch (requestError) {
      setError(
        requestError.message ||
          'Unable to reset your password. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="ACCOUNT RECOVERY"
      title={
        success
          ? username.trim()
            ? 'Password and username updated'
            : 'Password updated'
          : 'Create a new password'
      }
      description={
        success
          ? username.trim()
            ? 'Your password and username have been updated successfully. You can now sign in with your new credentials.'
            : 'Your password has been reset successfully. You can now sign in with your new password.'
          : 'Your verification code has been accepted. Enter a new password below. You may also change your username.'
      }
      onHome={onHome}
    >
      {success ? (
        <button
          className="primary-button auth-submit"
          type="button"
          onClick={onLogin}
        >
          Return to sign in
        </button>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="new-password">New password</label>
<PasswordInput
  id="new-password"
  name="password"
  autoComplete="new-password"
  placeholder="Enter your new password"
  value={password}
  onChange={(event) => setPassword(event.target.value)}
  minLength={8}
  maxLength={40}
  required
/>

<label htmlFor="confirm-password">Confirm new password</label>
<PasswordInput
  id="confirm-password"
  name="confirmPassword"
  autoComplete="new-password"
  placeholder="Confirm your new password"
  value={confirmPassword}
  onChange={(event) => setConfirmPassword(event.target.value)}
  minLength={8}
  maxLength={40}
  required
/>

<label htmlFor="new-username">New username (optional)</label>
<input
  id="new-username"
  name="username"
  type="text"
  autoComplete="username"
  placeholder="Enter a new username"
  value={username}
  onChange={(event) => setUsername(event.target.value)}
  minLength={3}
  maxLength={30}
  pattern="[A-Za-z0-9_]{3,30}"
/>
<p className="auth-footnote">
  Leave blank to keep your current username.
</p>

<p className="auth-footnote">
            Use 8–40 characters, including at least one letter, one number,
            and one special character.
          </p>

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
            {submitting ? 'Updating password…' : 'Reset password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}