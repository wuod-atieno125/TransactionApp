import { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../shared/components/PageHeader.jsx'
import Avatar from '../../../shared/components/ui/Avatar.jsx'
import StatusBadge from '../../../shared/components/ui/StatusBadge.jsx'
import { deleteMemberAccount } from '../../approvals/services/adminService.js'
import { getMembers } from '../services/memberService.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'

function formatRole(role) {
  const normalizedRole = String(role || 'member').trim().toLowerCase()
  return normalizedRole === 'member'
    ? 'Member'
    : normalizedRole.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
}

function isOfficeHolder(role) {
  return ['chairperson', 'secretary', 'treasurer']
    .includes(String(role || '').trim().toLowerCase())
}

export default function MembersPage({ user }) {
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [confirmingDeletion, setConfirmingDeletion] = useState(null)
  const [deletionReason, setDeletionReason] = useState('')
  const [deletionError, setDeletionError] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const viewerRole = String(user?.role || '').trim().toLowerCase()
  const canDeleteMembers = viewerRole === 'chairperson'

  useAutoDismiss(error, setError)
  useAutoDismiss(success, setSuccess)

  useEffect(() => {
    let active = true

    getMembers()
      .then(result => {
        if (active) setMembers(result)
      })
      .catch(requestError => {
        if (active) setError(requestError.message || 'Unable to load members.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return members
    return members.filter(member =>
      String(member.fullName || '').toLowerCase().includes(term),
    )
  }, [members, search])

  function openDeletionConfirmation(member) {
    setConfirmingDeletion(member)
    setDeletionReason('')
    setDeletionError('')
  }

  async function confirmMemberDeletion() {
    if (!confirmingDeletion) return
    const reason = deletionReason.trim()
    if (reason.length < 5 || reason.length > 1000) {
      setDeletionError('Enter a reason between 5 and 1000 characters.')
      return
    }

    setDeletingId(confirmingDeletion.id)
    setDeletionError('')
    setError('')
    setSuccess('')

    try {
      const result = await deleteMemberAccount(confirmingDeletion.id, reason)
      setMembers(current => current.filter(member => member.id !== confirmingDeletion.id))
      setSuccess(result.message || 'Member account deleted and fellow members notified.')
      setConfirmingDeletion(null)
      setDeletionReason('')
    } catch (requestError) {
      setDeletionError(requestError.message || 'Unable to delete this member account.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="YOUR COMMUNITY"
        title="Members"
        description="Registered and approved members in your group."
      />
      <section className="content-card">
        <div className="toolbar">
          <input
            aria-label="Search members"
            placeholder="Search by member name"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <span className="record-count">
            {loading
              ? 'Loading members…'
              : error
                ? 'Member list unavailable'
                : search
                  ? `${results.length} of ${members.length} members`
                  : `${members.length} members`}
          </span>
        </div>

        {error && <p className="app-error" role="alert">{error}</p>}
        {success && <p className="account-success" role="status">{success}</p>}
        {loading ? (
          <p className="empty-state" aria-live="polite">Loading members…</p>
        ) : error ? null : (
          results.length === 0 ? (
          <p className="empty-state">
            {search ? 'No members match your search.' : 'There are no approved members yet.'}
          </p>
          ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">MEMBER</th>
                  <th scope="col">ROLE</th>
                  <th scope="col">REGISTERED</th>
                  <th scope="col">STATUS</th>
                  {canDeleteMembers && <th scope="col">ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {results.map(member => (
                  <tr key={member.id}>
                    <td>
                      <span className="person-cell">
                        <Avatar name={member.fullName} />
                        {member.fullName}
                      </span>
                    </td>
                    <td>
                      <StatusBadge tone={formatRole(member.role) === 'Member' ? 'neutral' : 'success'}>
                        {formatRole(member.role)}
                      </StatusBadge>
                    </td>
                    <td>
                      {member.registeredAt
                        ? new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(new Date(member.registeredAt))
                        : '—'}
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          member.accountStatus === 'pending'
                            ? 'warning'
                            : member.accountStatus === 'disabled'
                              ? 'neutral'
                              : 'success'
                        }
                      >
                        {member.accountStatus === 'pending'
                          ? 'Pending'
                          : member.accountStatus === 'disabled'
                            ? 'Disabled'
                            : 'Active'}
                      </StatusBadge>
                    </td>
                    {canDeleteMembers && (
                      <td>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={isOfficeHolder(member.role)}
                          title={isOfficeHolder(member.role) ? 'Office holder accounts cannot be deleted here.' : undefined}
                          onClick={() => openDeletionConfirmation(member)}
                        >
                          Delete account
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )
        )}
      </section>
      {confirmingDeletion && (
        <div className="deletion-confirmation-backdrop">
          <section
            className="deletion-confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="member-deletion-title"
            aria-describedby="member-deletion-description"
          >
            <h2 id="member-deletion-title">Delete member account?</h2>
            <p id="member-deletion-description">
              This will anonymize <strong>{confirmingDeletion.fullName}</strong>’s
              account and revoke their access. Transaction records will remain
              unchanged, and other active members will be notified with your reason.
            </p>
            <div className="deletion-decision-field">
              <label htmlFor="member-deletion-reason">
                Reason for deletion
                <textarea
                  className="deletion-decision-textarea"
                  id="member-deletion-reason"
                  value={deletionReason}
                  onChange={event => setDeletionReason(event.target.value)}
                  placeholder="Explain why this member account is being deleted."
                  minLength={5}
                  maxLength={1000}
                  rows={4}
                  required
                />
              </label>
              <div className="deletion-decision-field-footer">
                <span>This reason is recorded in the audit log and sent to members.</span>
                <span>{deletionReason.length}/1000</span>
              </div>
            </div>
            {deletionError && <p className="app-error" role="alert">{deletionError}</p>}
            <div className="deletion-confirmation-actions">
              <button
                type="button"
                className="secondary-button"
                autoFocus
                onClick={() => {
                  setConfirmingDeletion(null)
                  setDeletionError('')
                }}
                disabled={deletingId === confirmingDeletion.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="deletion-confirm-button"
                onClick={confirmMemberDeletion}
                disabled={
                  deletingId === confirmingDeletion.id ||
                  deletionReason.trim().length < 5 ||
                  deletionReason.trim().length > 1000
                }
              >
                {deletingId === confirmingDeletion.id ? 'Deleting…' : 'Confirm deletion'}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
