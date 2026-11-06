import { useEffect, useState } from 'react'
import PageHeader from '../../../shared/components/PageHeader.jsx'
import PasswordInput from '../../../shared/components/PasswordInput.jsx'
import { changePassword } from '../../authentication/services/authService.js'
import { getPaymentDestination, savePaymentDestination } from '../../group-management/services/paymentDestinationService.js'
import ProfilePictureEditor from '../components/ProfilePictureEditor.jsx'
import {
  getMyAccount,
  getMyDeletionRequest,
  getMyRoleRemovalRequest,
  requestAccountDeletion,
  requestRoleRemoval,
  updateMyAccount,
} from '../services/memberService.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'
import { isKenyanMobilePhone } from '../../../shared/utils/phoneNumber.js'

export default function AccountPage({ user, onAccountUpdated, embedded = false }) {
  const requiresStrongPassword = user?.role === 'technical_admin'
  const [account, setAccount] = useState(null)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [deletionRequest, setDeletionRequest] = useState(null)
  const [deletionStatusLoading, setDeletionStatusLoading] = useState(false)
  const [deletionReason, setDeletionReason] = useState('')
  const [deletionSaving, setDeletionSaving] = useState(false)
  const [deletionError, setDeletionError] = useState('')
  const [deletionSuccess, setDeletionSuccess] = useState('')
  const [roleRemovalRequest, setRoleRemovalRequest] = useState(null)
  const [roleRemovalLoading, setRoleRemovalLoading] = useState(false)
  const [roleRemovalReason, setRoleRemovalReason] = useState('')
  const [roleRemovalSaving, setRoleRemovalSaving] = useState(false)
  const [roleRemovalError, setRoleRemovalError] = useState('')
  const [roleRemovalSuccess, setRoleRemovalSuccess] = useState('')
  const isMember = user?.role === 'member'
  const isTreasurer = user?.role === 'treasurer'
  const isOfficial = ['chairperson', 'secretary', 'treasurer'].includes(user?.role)
  const [paymentNumber, setPaymentNumber] = useState('')
  const [paymentNumberInputActive, setPaymentNumberInputActive] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(isTreasurer)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')

  useAutoDismiss(error, setError)
  useAutoDismiss(success, setSuccess)
  useAutoDismiss(passwordError, setPasswordError)
  useAutoDismiss(passwordSuccess, setPasswordSuccess)
  useAutoDismiss(deletionError, setDeletionError)
  useAutoDismiss(deletionSuccess, setDeletionSuccess)
  useAutoDismiss(roleRemovalError, setRoleRemovalError)
  useAutoDismiss(roleRemovalSuccess, setRoleRemovalSuccess)
  useAutoDismiss(paymentError, setPaymentError)
  useAutoDismiss(paymentSuccess, setPaymentSuccess)

  useEffect(() => {
    let active = true

    getMyAccount()
      .then(result => {
        if (!active) return
        setAccount(result)
        setFullName(result.fullName || '')
        setUsername(result.username || '')
        setPhone(result.phone || '')
        setRecoveryEmail(result.recoveryEmail || '')
      })
      .catch(requestError => {
        if (active) setError(requestError.message || 'Unable to load your account.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isTreasurer) return undefined
    let active = true
    getPaymentDestination()
      .then(destination => {
        if (active) setPaymentNumber(destination?.paymentNumber || '')
      })
      .catch(requestError => {
        if (active) setPaymentError(requestError.message || 'Unable to load the group payment number.')
      })
      .finally(() => {
        if (active) setPaymentLoading(false)
      })
    return () => { active = false }
  }, [isTreasurer])

  async function handlePaymentNumberSubmit(event) {
    event.preventDefault()
    setPaymentError('')
    setPaymentSuccess('')
    setPaymentSaving(true)
    try {
      const result = await savePaymentDestination(paymentNumber.trim())
      setPaymentNumber(result.paymentDestination.paymentNumber)
      setPaymentSuccess(result.message || 'Group payment number saved.')
    } catch (requestError) {
      setPaymentError(requestError.message || 'Unable to save the group payment number.')
    } finally {
      setPaymentSaving(false)
    }
  }

  useEffect(() => {
    if (!isMember) return undefined

    let active = true
    setDeletionStatusLoading(true)
    getMyDeletionRequest()
      .then(result => {
        if (active) setDeletionRequest(result)
      })
      .catch(requestError => {
        if (active) setDeletionError(requestError.message || 'Unable to load deletion request status.')
      })
      .finally(() => {
        if (active) setDeletionStatusLoading(false)
      })

    return () => {
      active = false
    }
  }, [isMember])

  useEffect(() => {
    if (!isOfficial) return undefined

    let active = true
    setRoleRemovalLoading(true)
    getMyRoleRemovalRequest()
      .then(result => {
        if (active) setRoleRemovalRequest(result)
      })
      .catch(requestError => {
        if (active) {
          setRoleRemovalError(requestError.message || 'Unable to load your role-removal request.')
        }
      })
      .finally(() => {
        if (active) setRoleRemovalLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOfficial])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!isKenyanMobilePhone(phone)) {
      setError('Enter a valid Kenyan mobile number, such as 0712 345 678 or +254 712 345 678.')
      return
    }

    setSaving(true)

    try {
      const updated = await updateMyAccount({
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.trim(),
        recoveryEmail: recoveryEmail.trim(),
      })

      setAccount(updated)
      setFullName(updated.fullName || '')
      setUsername(updated.username || '')
      setPhone(updated.phone || '')
      setRecoveryEmail(updated.recoveryEmail || '')
      onAccountUpdated?.(updated)
      setSuccess('Your account settings have been saved.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to save your account settings.')
    } finally {
      setSaving(false)
    }
  }

  function handleProfilePictureUpdated(profilePictureUpdatedAt) {
    setAccount(current => current
      ? { ...current, profilePictureUpdatedAt }
      : current)
    if (account) {
      onAccountUpdated?.({ ...account, profilePictureUpdatedAt })
    }
  }

  async function handleDeletionRequest(event) {
    event.preventDefault()
    setDeletionError('')
    setDeletionSuccess('')
    setDeletionSaving(true)

    try {
      const result = await requestAccountDeletion(deletionReason.trim())
      setDeletionRequest(result.deletionRequest)
      setDeletionReason('')
      setDeletionSuccess(result.message || 'Your deletion request was sent to the chairperson.')
    } catch (requestError) {
      setDeletionError(requestError.message || 'Unable to request account deletion.')
    } finally {
      setDeletionSaving(false)
    }
  }

  async function handleRoleRemovalRequest(event) {
    event.preventDefault()
    setRoleRemovalError('')
    setRoleRemovalSuccess('')
    setRoleRemovalSaving(true)

    try {
      const result = await requestRoleRemoval(roleRemovalReason.trim())
      setRoleRemovalRequest(result.roleRemovalRequest)
      setRoleRemovalReason('')
      setRoleRemovalSuccess(result.message || 'Your role-removal request was sent to the Technical Admin.')
    } catch (requestError) {
      setRoleRemovalError(requestError.message || 'Unable to submit your role-removal request.')
    } finally {
      setRoleRemovalSaving(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.')
      return
    }

    const hasRequiredCharacters = requiresStrongPassword
      ? /[A-Z]/.test(newPassword) &&
        /[a-z]/.test(newPassword) &&
        /\d/.test(newPassword) &&
        /[^A-Za-z0-9\s]/.test(newPassword)
      : /[A-Za-z]/.test(newPassword) &&
        /\d/.test(newPassword) &&
        /[^A-Za-z0-9\s]/.test(newPassword)

    if (!hasRequiredCharacters) {
      setPasswordError(
        requiresStrongPassword
          ? 'Use uppercase and lowercase letters, a number, and a special character.'
          : 'Use a password with a letter, a number, and a special character.',
      )
      return
    }

    setPasswordSaving(true)
    try {
      const result = await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(result.message || 'Your password has been changed.')
    } catch (requestError) {
      setPasswordError(requestError.message || 'Unable to change your password.')
    } finally {
      setPasswordSaving(false)
    }
  }

  const hasProfileChanges = Boolean(
    account && (
      fullName !== (account.fullName || '') ||
      username !== (account.username || '') ||
      phone !== (account.phone || '') ||
      recoveryEmail !== (account.recoveryEmail || '')
    ),
  )
  const hasPasswordChanges = Boolean(
    currentPassword || newPassword || confirmPassword,
  )

  return (
    <>
      {!embedded && (
        <PageHeader
          eyebrow="PERSONAL"
          title="Account settings"
          description="Update your name, username, and contact details."
        />
      )}

      <section className="content-card account-card">
        <div className="account-card-heading">
          <div>
            <h2>Profile information</h2>
            <p>Your changes are saved to your pamoja account.</p>
          </div>
          {account?.role && (
            <span className="account-role-badge">{account.role}</span>
          )}
        </div>

        {error && <p className="app-error" role="alert">{error}</p>}
        {success && <p className="account-success" role="status">{success}</p>}

        {loading ? (
          <p className="empty-state" aria-live="polite">Loading account details…</p>
        ) : account ? (
          <form className="account-form" onSubmit={handleSubmit}>
            <label htmlFor="account-full-name">
              Full name
              <input
                id="account-full-name"
                name="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                minLength={2}
                maxLength={150}
                required
              />
            </label>

            <label htmlFor="account-username">
              Username
              <input
                id="account-username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={event => setUsername(event.target.value)}
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]{3,30}"
                placeholder="Choose a username"
                required
              />
            </label>
            <p className="password-change-hint">Use 3–30 letters, numbers, or underscores. Usernames are case-insensitive and can be used to sign in.</p>

            <label htmlFor="account-phone">
              Phone number
              <input
                id="account-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={event => setPhone(event.target.value)}
                placeholder="0712 345 678 or +254 712 345 678"
                maxLength={24}
                required
              />
            </label>
            <p className="password-change-hint">Use a Kenyan mobile number starting with 07, 01, or +254.</p>

            <label htmlFor="account-recovery-email">
              Recovery email
              <input
                id="account-recovery-email"
                name="recoveryEmail"
                type="email"
                autoComplete="email"
                value={recoveryEmail}
                onChange={event => setRecoveryEmail(event.target.value)}
                maxLength={254}
                required
              />
            </label>

            <button className="primary-button" type="submit" disabled={saving || !hasProfileChanges}>
              {saving ? 'Saving changes…' : 'Save changes'}
            </button>
          </form>
        ) : !error ? (
          <p className="empty-state">Account details are unavailable.</p>
        ) : null}
      </section>

      {account && !loading && (
        <section className="content-card account-card">
          <ProfilePictureEditor
            account={account}
            onUpdated={handleProfilePictureUpdated}
          />
        </section>
      )}

      {isTreasurer && (
        <section className="content-card account-card">
          <div className="account-card-heading">
            <div>
              <h2>Group contribution payment number</h2>
              <p>Members will see this number on their dashboard when making contributions.</p>
            </div>
          </div>
          {paymentError && <p className="app-error" role="alert">{paymentError}</p>}
          {paymentSuccess && <p className="account-success" role="status">{paymentSuccess}</p>}
          {paymentLoading ? <p className="empty-state" aria-live="polite">Loading payment number…</p> : (
            <form className="account-form" onSubmit={handlePaymentNumberSubmit}>
              <label htmlFor="group-payment-number">
                Paybill, Till, or payment number
                <input
                  id="group-payment-number"
                  name="paymentNumber"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={paymentNumber}
                  onChange={event => setPaymentNumber(event.target.value)}
                  onFocus={() => setPaymentNumberInputActive(true)}
                  placeholder="Enter 5 to 20 digits"
                  maxLength={24}
                  required
                />
              </label>
              <p className="password-change-hint">Enter digits only. Spaces and hyphens are removed when saved.</p>
              <button className="primary-button" type="submit" disabled={paymentSaving || !paymentNumberInputActive || paymentNumber.replace(/[\s-]/g, '').length < 5}>
                {paymentSaving ? 'Saving…' : 'Save payment number'}
              </button>
            </form>
          )}
        </section>
      )}

      {isMember && (
        <section className="content-card account-card">
          <div className="account-card-heading">
            <div>
              <h2>Request account deletion</h2>
              <p>
                A chairperson must review and approve this request. Your contribution
                transaction records will be retained for group integrity.
              </p>
            </div>
          </div>

          {deletionError && <p className="app-error" role="alert">{deletionError}</p>}
          {deletionSuccess && <p className="account-success" role="status">{deletionSuccess}</p>}

          {deletionStatusLoading ? (
            <p className="empty-state" role="status">Checking your account deletion request…</p>
          ) : deletionRequest ? (
            <div role="status">
              <p>
                Your request is awaiting chairperson approval. Submitted reason:
              </p>
              <p><strong>{deletionRequest.reason}</strong></p>
              {deletionRequest.requestedAt && (
                <p className="password-change-hint">
                  Requested {new Date(deletionRequest.requestedAt).toLocaleString('en-KE')}
                </p>
              )}
            </div>
          ) : (
            <>
            {!deletionError && <p className="password-change-hint" role="status">You have no pending account deletion request.</p>}
            <form className="account-form" onSubmit={handleDeletionRequest}>
              <label htmlFor="account-deletion-reason">
                Reason for your request
                <textarea
                  id="account-deletion-reason"
                  name="reason"
                  value={deletionReason}
                  onChange={event => setDeletionReason(event.target.value)}
                  minLength={5}
                  maxLength={1000}
                  rows={4}
                  required
                />
              </label>
              <button
                className="secondary-button"
                type="submit"
                disabled={deletionSaving || deletionReason.trim().length < 5}
              >
                {deletionSaving ? 'Sending request…' : 'Request account deletion'}
              </button>
            </form>
            </>
          )}
        </section>
      )}

      {isOfficial && (
        <section className="content-card account-card">
          <div className="account-card-heading">
            <div>
              <h2>Request to step down</h2>
              <p>
                The Technical Admin will review your request. You will remain
                {` ${user.role}`} until it is approved.
              </p>
            </div>
          </div>

          {roleRemovalError && <p className="app-error" role="alert">{roleRemovalError}</p>}
          {roleRemovalSuccess && <p className="account-success" role="status">{roleRemovalSuccess}</p>}
          {roleRemovalLoading ? (
            <p className="empty-state" role="status">Checking your role-removal request…</p>
          ) : roleRemovalRequest ? (
            <div role="status">
              <p>Your request to step down as {roleRemovalRequest.officeRole} is awaiting Technical Admin review.</p>
              <p><strong>{roleRemovalRequest.reason}</strong></p>
              {roleRemovalRequest.requestedAt && (
                <p className="password-change-hint">
                  Submitted {new Date(roleRemovalRequest.requestedAt).toLocaleString('en-KE')}
                </p>
              )}
            </div>
          ) : (
            <form className="account-form" onSubmit={handleRoleRemovalRequest}>
              <label htmlFor="role-removal-reason">
                Reason for stepping down
                <textarea
                  id="role-removal-reason"
                  value={roleRemovalReason}
                  onChange={event => setRoleRemovalReason(event.target.value)}
                  minLength={5}
                  maxLength={1000}
                  rows={4}
                  required
                />
              </label>
              <button
                className="secondary-button"
                type="submit"
                disabled={roleRemovalSaving || roleRemovalReason.trim().length < 5}
              >
                {roleRemovalSaving ? 'Sending request…' : 'Request to step down'}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="content-card account-card password-card">
        <div className="account-card-heading">
          <div>
            <h2>Change password</h2>
            <p>Confirm your current password, then choose a new one.</p>
          </div>
        </div>

        {passwordError && <p className="app-error" role="alert">{passwordError}</p>}
        {passwordSuccess && <p className="account-success" role="status">{passwordSuccess}</p>}

        <form className="account-form" onSubmit={handlePasswordSubmit}>
          <label htmlFor="current-password">
            Current password
            <PasswordInput
              id="current-password"
              name="currentPassword"
              autoComplete="current-password"
              placeholder="Enter your current password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              maxLength={128}
              required
            />
          </label>

          <label htmlFor="new-password">
            New password
            <PasswordInput
              id="new-password"
              name="newPassword"
              autoComplete="new-password"
              placeholder="Create a new password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              minLength={8}
              maxLength={40}
              required
            />
          </label>

          <p className="password-change-hint">
            {requiresStrongPassword
              ? '8–40 characters, including uppercase and lowercase letters, a number, and a special character.'
              : '8–40 characters, including a letter, a number, and a special character.'}
          </p>

          <label htmlFor="confirm-new-password">
            Confirm new password
            <PasswordInput
              id="confirm-new-password"
              name="confirmNewPassword"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              minLength={8}
              maxLength={40}
              required
            />
          </label>

          <button className="primary-button" type="submit" disabled={passwordSaving || !hasPasswordChanges}>
            {passwordSaving ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      </section>
    </>
  )
}
