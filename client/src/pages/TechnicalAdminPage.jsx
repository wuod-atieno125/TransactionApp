
import { useCallback, useEffect, useState } from 'react'
import { Info, RefreshCw, UsersRound, UserRoundCheck, WalletCards } from 'lucide-react'
import {
  decideRoleRemovalRequest,
  getRoleRemovalRequests,
  getTechnicalAdminUsers,
  sendAppUpdateAnnouncement,
  updateUserRole,
} from '../services/technicalAdminService.js'
import useAutoDismiss from '../hooks/useAutoDismiss.js'
import './technical-admin.css'

const assignableRoles = [
  { value: 'member', label: 'Member' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'chairperson', label: 'Chairperson' },
  { value: 'secretary', label: 'Secretary' },
]
const roleOrder = ['technical_admin', 'chairperson', 'secretary', 'treasurer', 'member']

export default function TechnicalAdminPage({ user: currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedRoles, setSelectedRoles] = useState({})
  const [pendingRoleChange, setPendingRoleChange] = useState(null)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementMessage, setAnnouncementMessage] = useState('')
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false)
  const [roleRemovalRequests, setRoleRemovalRequests] = useState([])
  const [roleRemovalLoading, setRoleRemovalLoading] = useState(true)
  const [roleRemovalBusyId, setRoleRemovalBusyId] = useState('')

  useAutoDismiss(error, setError)
  useAutoDismiss(notice, setNotice)

  const treasurerCount = users.filter(user => user.role === 'treasurer').length
  const chairpersonCount = users.filter(user => user.role === 'chairperson').length

  const sortedUsers = users
    .map((user, index) => ({ user, index }))
    .sort((a, b) => {
      const roleDifference =
        roleOrder.indexOf(a.user.role) - roleOrder.indexOf(b.user.role)

      if (roleDifference === 0) return a.index - b.index
      if (roleOrder.indexOf(a.user.role) === -1) return 1
      if (roleOrder.indexOf(b.user.role) === -1) return -1
      return roleDifference
    })
    .map(({ user }) => user)

  function getInitials(name = '') {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase()
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const result = await getTechnicalAdminUsers()
      setUsers(result)
      setSelectedRoles(
        Object.fromEntries(result.map(user => [user.id, user.role])),
      )
    } catch (err) {
      setError(err.message || 'Unable to load approved users.')
    } finally {
      setLoading(false)
    }
  }, [])


  const loadRoleRemovalRequests = useCallback(async () => {
    setRoleRemovalLoading(true)
    setError('')
    try {
      setRoleRemovalRequests(await getRoleRemovalRequests())
    } catch (err) {
      setError(err.message || 'Unable to load official role-removal requests.')
    } finally {
      setRoleRemovalLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    loadRoleRemovalRequests()
  }, [loadRoleRemovalRequests])

  async function handleSave(user) {
    if (user.id === currentUser?.id) return

    const nextRole = selectedRoles[user.id]

    if (!nextRole || nextRole === user.role) return

    setPendingRoleChange({ user, nextRole })
  }

  async function handleSendAnnouncement(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSendingAnnouncement(true)

    try {
      const result = await sendAppUpdateAnnouncement({
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
      })
      setAnnouncementTitle('')
      setAnnouncementMessage('')
      setNotice(
        `${result.message || 'App update announcement sent.'} ${result.recipientCount} approved account${result.recipientCount === 1 ? '' : 's'} notified.`,
      )
    } catch (err) {
      setError(err.message || 'Unable to send the app update announcement.')
    } finally {
      setSendingAnnouncement(false)
    }
  }

  async function handleRoleRemovalDecision(request, decision) {
    setRoleRemovalBusyId(request.id)
    setError('')
    setNotice('')
    try {
      const result = await decideRoleRemovalRequest(request.id, decision)
      setRoleRemovalRequests(current => current.filter(item => item.id !== request.id))
      setNotice(result.message || 'Role-removal request reviewed.')
      if (decision === 'approved') await loadUsers()
    } catch (err) {
      setError(err.message || 'Unable to review the role-removal request.')
    } finally {
      setRoleRemovalBusyId('')
    }
  }

  function cancelRoleChange() {
    if (!pendingRoleChange) return

    setSelectedRoles(current => ({
      ...current,
      [pendingRoleChange.user.id]: pendingRoleChange.user.role,
    }))
    setPendingRoleChange(null)
  }

  async function confirmRoleChange() {
    if (!pendingRoleChange) return

    const { user, nextRole } = pendingRoleChange
    setSavingId(user.id)
    setError('')
    setNotice('')

    try {
      const result = await updateUserRole(user.id, nextRole)
      const updatedUser = result.user

      setUsers(current =>
        current.map(item =>
          item.id === user.id
            ? { ...item, role: updatedUser?.role || nextRole }
            : item,
        ),
      )

      setSelectedRoles(current => ({
        ...current,
        [user.id]: updatedUser?.role || nextRole,
      }))

      setPendingRoleChange(null)
      setNotice(`Role updated successfully for ${user.fullName}.`)
    } catch (err) {
      setSelectedRoles(current => ({
        ...current,
        [user.id]: user.role,
      }))
      setPendingRoleChange(null)
      setError(err.message || 'Unable to update the user role.')
    } finally {
      setSavingId('')
    }
  }

  return (
    <section className="technical-admin-page">
      <header className="page-header technical-admin-header">
        <div>
          <p className="eyebrow">SYSTEM MANAGEMENT</p>
          <h1>Technical Administration</h1>
          <p>
            Manage roles for approved GCMS accounts. Technical Administrator
            accounts cannot be changed from this screen.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary technical-admin-refresh"
          onClick={loadUsers}
          disabled={loading || Boolean(savingId) || Boolean(pendingRoleChange)}
        >
          <RefreshCw size={16} /> Refresh users
        </button>
      </header>

      <div className="technical-admin-overview">
        <article className="technical-admin-stat-card">
          <span className="technical-admin-stat-icon"><UsersRound size={21} /></span>
          <span className="technical-admin-stat-label">Approved accounts</span>
          <strong>{users.length}</strong>
        </article>
        <article className="technical-admin-stat-card">
          <span className="technical-admin-stat-icon"><UserRoundCheck size={21} /></span>
          <span className="technical-admin-stat-label">Chairpersons</span>
          <strong>{chairpersonCount}<small> / 1 min</small></strong>
          <span className="technical-admin-meter"><i style={{ width: `${Math.min(chairpersonCount * 100, 100)}%` }} /></span>
        </article>
        <article className="technical-admin-stat-card">
          <span className="technical-admin-stat-icon"><WalletCards size={21} /></span>
          <span className="technical-admin-stat-label">Treasurers</span>
          <strong>{treasurerCount}<small> / 2 max</small></strong>
          <span className="technical-admin-meter"><i style={{ width: `${Math.min(treasurerCount * 50, 100)}%` }} /></span>
        </article>
      </div>

      <p className="technical-admin-guidance"><Info size={18} /> Treasurer is optional. Assign up to two treasurers and at least one chairperson.</p>

      {error && (
        <div className="technical-admin-error" role="alert">
          <strong>Why this failed</strong>
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <p className="technical-admin-notice" role="status">
          {notice}
        </p>
      )}

      {pendingRoleChange && (
        <div className="technical-admin-confirmation-backdrop">
          <section
            className="technical-admin-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="role-change-confirmation-title"
            aria-describedby="role-change-confirmation-description"
          >
            <h2 id="role-change-confirmation-title">Confirm role change</h2>
            <p id="role-change-confirmation-description">
              Change {pendingRoleChange.user.fullName}&apos;s role from{' '}
              <strong>{pendingRoleChange.user.role}</strong> to{' '}
              <strong>{pendingRoleChange.nextRole}</strong>?
            </p>
            <div className="technical-admin-confirmation-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={cancelRoleChange}
                disabled={Boolean(savingId)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={confirmRoleChange}
                disabled={Boolean(savingId)}
              >
                {savingId ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="technical-admin-announcement-card" aria-labelledby="role-removal-requests-title">
        <div className="technical-admin-table-heading">
          <div>
            <h2 id="role-removal-requests-title">Official role-removal requests</h2>
            <p>Review requests from chairpersons, secretaries, and treasurers who want to step down.</p>
          </div>
          <button
            type="button"
            className="button button-secondary technical-admin-audit-refresh"
            onClick={loadRoleRemovalRequests}
            disabled={roleRemovalLoading}
          >
            <RefreshCw size={15} />
            {roleRemovalLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {roleRemovalLoading ? (
          <p className="technical-admin-role-removal-state" role="status">Loading role-removal requests…</p>
        ) : roleRemovalRequests.length === 0 ? (
          <p className="technical-admin-role-removal-state">There are no pending role-removal requests.</p>
        ) : (
          <div className="technical-admin-role-removal-list">
            {roleRemovalRequests.map(request => (
              <article className="technical-admin-role-removal-item" key={request.id}>
                <div>
                  <strong>{request.requesterName}</strong>
                  <span>{request.officeRole}</span>
                  <p>{request.reason}</p>
                  {request.requestedAt && (
                    <small>Submitted {new Date(request.requestedAt).toLocaleString('en-KE')}</small>
                  )}
                </div>
                <div className="technical-admin-role-removal-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={roleRemovalBusyId === request.id}
                    onClick={() => handleRoleRemovalDecision(request, 'rejected')}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={roleRemovalBusyId === request.id}
                    onClick={() => handleRoleRemovalDecision(request, 'approved')}
                  >
                    {roleRemovalBusyId === request.id ? 'Reviewing…' : 'Approve step-down'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="technical-admin-announcement-card" aria-labelledby="technical-admin-announcement-title">
        <div className="technical-admin-table-heading">
          <div>
            <h2 id="technical-admin-announcement-title">Announce an upcoming app update</h2>
            <p>Send an in-app notification to all approved members, treasurers, the secretary, and the chairperson.</p>
          </div>
        </div>
        <form className="technical-admin-announcement-form" onSubmit={handleSendAnnouncement}>
          <label>
            Announcement title
            <input
              value={announcementTitle}
              onChange={event => setAnnouncementTitle(event.target.value)}
              minLength={3}
              maxLength={200}
              required
            />
          </label>
          <label>
            Update details
            <textarea
              value={announcementMessage}
              onChange={event => setAnnouncementMessage(event.target.value)}
              minLength={5}
              maxLength={2000}
              rows={5}
              required
            />
          </label>
          <div className="technical-admin-announcement-footer">
            <span>Only active, approved accounts in the selected roles will be notified.</span>
            <button
              type="submit"
              className="button button-primary"
              disabled={
                sendingAnnouncement ||
                announcementTitle.trim().length < 3 ||
                announcementMessage.trim().length < 5
              }
            >
              {sendingAnnouncement ? 'Sending…' : 'Send announcement'}
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <p aria-live="polite">Loading approved users…</p>
      ) : users.length === 0 ? (
        <div className="technical-admin-empty">
          <h2>No approved users found</h2>
          <p>Approved accounts will appear here when available.</p>
        </div>
      ) : (
        <section className="technical-admin-assignment-card" aria-labelledby="technical-admin-assignments-title">
          <div className="technical-admin-table-heading">
            <h2 id="technical-admin-assignments-title">Officer assignments</h2>
            <span>{users.length} approved accounts</span>
          </div>
          <div className="technical-admin-table-wrap">
          <table className="technical-admin-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Phone</th>
                <th scope="col">Current role</th>
                <th scope="col">Assign role</th>
                <th scope="col">Action</th>
              </tr>
            </thead>

            <tbody>
              {sortedUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <span className="technical-admin-user-cell">
                      <span className="technical-admin-avatar" aria-hidden="true">{getInitials(user.fullName)}</span>
                      <span className="technical-admin-user-details">
                        <strong>{user.fullName}</strong>
                        {user.recoveryEmail && (
                          <small className="technical-admin-email">
                            {user.recoveryEmail}
                          </small>
                        )}
                      </span>
                    </span>
                  </td>

                  <td>{user.phone || '—'}</td>

                  <td>
                    <span className={`technical-admin-role technical-admin-role--${user.role}`}>
                      {assignableRoles.find(
                        role => role.value === user.role,
                      )?.label || user.role}
                    </span>
                  </td>

                  <td>
                    {user.id === currentUser?.id ? (
                      <span className="technical-admin-role-lock">
                        Technical_admin
                      </span>
                    ) : (
                      <select
                        aria-label={`Assign role to ${user.fullName}`}
                        value={selectedRoles[user.id] || user.role}
                        disabled={Boolean(savingId) || Boolean(pendingRoleChange)}
                        onChange={event =>
                          setSelectedRoles(current => ({
                            ...current,
                            [user.id]: event.target.value,
                          }))
                        }
                      >
                        {assignableRoles.map(role => (
                          <option
                            key={role.value}
                            value={role.value}
                            disabled={
                              role.value === 'treasurer' &&
                              user.role !== 'treasurer' &&
                              treasurerCount >= 2
                            }
                          >
                            {role.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>

                  <td>
                    {user.id === currentUser?.id ? (
                      <span className="technical-admin-role-lock">Current account</span>
                    ) : (
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={
                          Boolean(savingId) ||
                          Boolean(pendingRoleChange) ||
                          selectedRoles[user.id] === user.role
                        }
                        onClick={() => handleSave(user)}
                      >
                        {savingId === user.id ? 'Saving…' : 'Save role'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}

      <p className="technical-admin-footnote">
        Every successful role change is recorded in the system audit log.
      </p>
    </section>
  )
}
