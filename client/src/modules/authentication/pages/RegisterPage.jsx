
import { useState } from 'react'
import {
  registerAccount,
  sendEmailVerificationCode,
  verifyEmailCode
} from '../services/authService.js'
import AuthLayout from '../components/AuthLayout.jsx'
import PasswordInput from '../../../shared/components/PasswordInput.jsx'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'
import { isKenyanMobilePhone } from '../../../shared/utils/phoneNumber.js'

export default function RegisterPage({ onLogin, onHome }) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
const [codeSent, setCodeSent] = useState(false)
const [emailVerified, setEmailVerified] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
const [verifyingCode, setVerifyingCode] = useState(false)

  useAutoDismiss(error, setError)
  useAutoDismiss(success, setSuccess)

  const passwordHasLetter = /[A-Za-z]/.test(password)
  const passwordHasDigit = /\d/.test(password)
  const passwordHasSpecial = /[^A-Za-z0-9\s]/.test(password)
  const passwordHasValidLength = password.length >= 8 && password.length <= 15
  const passwordIsValid = passwordHasLetter && passwordHasDigit && passwordHasSpecial && passwordHasValidLength

function updateEmail(value) {
  setRecoveryEmail(value)
  setCodeSent(false)
  setEmailVerified(false)
  setVerificationCode('')
  setError('')
  setSuccess('')
}

async function handleSendCode() {
  setError('')
  setSuccess('')

  const email = recoveryEmail.trim()

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254
  ) {
    setError('Enter a valid email address first.')
    return
  }

  setSendingCode(true)

  try {
    const result = await sendEmailVerificationCode(email)

    setCodeSent(true)
    setEmailVerified(false)
    setVerificationCode('')
    setSuccess(
      result?.message ||
      'A verification code has been sent to your email.'
    )
  } catch (err) {
    setError(
      err.message ||
      'Unable to send the verification code. Please try again.'
    )
  } finally {
    setSendingCode(false)
  }
}

async function handleVerifyCode() {
  setError('')
  setSuccess('')

  if (!/^\d{6}$/.test(verificationCode.trim())) {
    setError('Enter the six-digit code sent to your email.')
    return
  }

  setVerifyingCode(true)

  try {
    const result = await verifyEmailCode(
      recoveryEmail.trim(),
      verificationCode.trim()
    )

    setEmailVerified(true)
    setSuccess(
      result?.message ||
      'Email verified successfully. You can now create your account.'
    )
  } catch (err) {
    setError(
      err.message ||
      'Unable to verify this code. Please check it and try again.'
    )
  } finally {
    setVerifyingCode(false)
  }
}


  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!isKenyanMobilePhone(phone)) {
      setError('Enter a valid Kenyan mobile number, such as 0712 345 678 or +254 712 345 678.')
      return
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      setError('Choose a username with 3–30 letters, numbers, or underscores.')
      return
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    if (!passwordIsValid) {
      setError('Use 8–15 characters with at least one letter, one digit, and one special character.')
      return
    }
    if (!emailVerified) {
  setError('Verify your email address before creating your account.')
  return
}

    setSubmitting(true)

    try {
      const result = await registerAccount({
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        recoveryEmail: recoveryEmail.trim(),
        password,
      })

      setSuccess(
        result?.message ||
          'Registration submitted. Your account may require group approval before you can sign in.',
      )
      setFullName('')
      setUsername('')
      setPhone('')
      setRecoveryEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err.message || 'Unable to create your account. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      variant="register"
      eyebrow="GET STARTED"
      title="Create your account"
      description="Verify your email address before registering."
      onHome={onHome}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="register-name">Full name</label>
          <input
            id="register-name"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Enter your full name"
            value={fullName}
            onChange={event => setFullName(event.target.value)}
            required
          />

          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="Choose a username"
            value={username}
            onChange={event => setUsername(event.target.value)}
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_]{3,30}"
            required
          />
          <p className="password-requirements">
            Use 3–30 letters, numbers, or underscores. Usernames are case-insensitive.
          </p>

          <label htmlFor="register-phone">Phone number</label>
          <input
            id="register-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="0712 345 678 or +254 712 345 678"
            value={phone}
            onChange={event => setPhone(event.target.value)}
            maxLength={24}
            required
          />

          <label htmlFor="register-email">Recovery email</label>
          
<label htmlFor="register-email">Email address</label>
<input
  id="register-email"
  name="recoveryEmail"
  type="email"
  autoComplete="email"
  placeholder="Enter an email address you can access"
  value={recoveryEmail}
  onChange={event => updateEmail(event.target.value)}
  maxLength={254}
  required
/>

{!emailVerified && (
  <button
    className="primary-button"
    type="button"
    onClick={handleSendCode}
    disabled={sendingCode || verifyingCode || submitting}
  >
    {sendingCode
      ? 'Sending code…'
      : codeSent
        ? 'Resend verification code'
        : 'Send verification code'}
  </button>
)}

{codeSent && !emailVerified && (
  <>
    <label htmlFor="register-email-code">
      Six-digit verification code
    </label>

    <input
      id="register-email-code"
      name="verificationCode"
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="Enter the code from your email"
      value={verificationCode}
      onChange={event =>
        setVerificationCode(
          event.target.value.replace(/\D/g, '').slice(0, 6)
        )
      }
      maxLength={6}
      required
    />

    <button
      className="primary-button"
      type="button"
      onClick={handleVerifyCode}
      disabled={verifyingCode || sendingCode || submitting}
    >
      {verifyingCode ? 'Verifying…' : 'Verify email'}
    </button>
  </>
)}

{emailVerified && (
  <p className="auth-success" role="status">
    Email verified. You can now create your account.
  </p>
)}

          <label htmlFor="register-password">Password</label>
          <PasswordInput
            id="register-password"
            name="password"
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
            maxLength={15}
          />
          <p className="password-requirements" aria-live="polite">
            Password must be 8–15 characters and include a letter, a digit, and a special character.
            {password.length > 0 && (
              <span className={passwordIsValid ? 'password-requirements-status valid' : 'password-requirements-status'}>
                {passwordIsValid ? ' Password meets all requirements.' : ' Password requirements not met yet.'}
              </span>
            )}
          </p>

          <label htmlFor="register-confirm-password">
            Confirm password
          </label>
          <PasswordInput
            id="register-confirm-password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            required
            maxLength={15}
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="auth-success" role="status">
              {success}
            </p>
          )}
          {submitting && <p className="auth-status" role="status">Submitting your registration…</p>}

          <button
           className="primary-button auth-submit"
            type="submit"
            disabled={submitting || !emailVerified}
           >
         {submitting ? 'Creating account…' : 'Create account'}
</button>
      </form>

      <p className="auth-footnote">
        Already registered?{' '}
        <button
          type="button"
          className="link-button auth-account-link"
          onClick={onLogin}
        >
          Sign in
        </button>
      </p>
    </AuthLayout>
  )
}
