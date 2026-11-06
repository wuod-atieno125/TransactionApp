import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Save } from 'lucide-react'
import FeaturePage from '../../../shared/components/FeaturePage.jsx'
import {
  deleteNextMeeting,
  getNextMeeting,
  saveNextMeeting,
} from '../services/meetingsService.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'

const getMeeting = payload =>
  payload?.meeting ??
  payload?.nextMeeting ??
  payload?.next_meeting ??
  payload

function getMeetingDate(meeting) {
  return (
    meeting?.startsAt ??
    meeting?.starts_at ??
    meeting?.meetingAt ??
    meeting?.meeting_at ??
    meeting?.meetingDate ??
    meeting?.meeting_date ??
    meeting?.date ??
    ''
  )
}

function toLocalDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function MeetingsPage({ user }) {
  const canEdit = String(user?.role ?? '').toLowerCase() === 'chairperson'

  const [meeting, setMeeting] = useState(null)
  const meetingAtInputRef = useRef(null)
  const [title, setTitle] = useState('')
  const [meetingAt, setMeetingAt] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useAutoDismiss(error, setError)
  useAutoDismiss(success, setSuccess)

  function openMeetingDatePicker() {
    const input = meetingAtInputRef.current
    if (!input) return

    if (typeof input.showPicker === 'function') {
      input.showPicker()
      return
    }

    input.focus()
    input.click()
  }

  useEffect(() => {
    let active = true

    getNextMeeting()
      .then(payload => {
        if (!active) return

        const item = getMeeting(payload)
        setMeeting(item)
        setTitle(item?.title ?? '')
        setMeetingAt(getMeetingDate(item) ? toLocalDateTime(getMeetingDate(item)) : '')
        setNotes(item?.description ?? item?.notes ?? item?.agenda ?? '')
      })
      .catch(err => {
        if (active) setError(err.message || 'Could not load the next meeting.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function handleSave(event) {
    event.preventDefault()
    await saveMeeting({
      title: title.trim(),
      description: notes.trim() || null,
      clearForm: true,
    })
  }

  async function handleSaveMeetingDateTime() {
    await saveMeeting({
      title: title.trim() || meeting?.title || '',
      description: notes.trim() || meeting?.description || null,
      clearForm: false,
    })
  }

  async function saveMeeting({ title: meetingTitle, description: meetingDescription, clearForm }) {
    setError('')
    setSuccess('')
    setSaving(true)

    const startsAt = new Date(meetingAt)

    if (Number.isNaN(startsAt.getTime())) {
      setError('Enter a valid meeting date and time.')
      setSaving(false)
      return
    }

    try {
      const payload = await saveNextMeeting({
        title: meetingTitle,
        startsAt: startsAt.toISOString(),
        description: meetingDescription,
        location: meeting?.location ?? null,
      })

      const savedMeeting = getMeeting(payload)
      const persistedMeeting = savedMeeting || {
        title: meetingTitle,
        startsAt: startsAt.toISOString(),
        description: meetingDescription,
        location: meeting?.location ?? null,
      }
      setMeeting(persistedMeeting)
      if (clearForm) {
        setTitle('')
        setMeetingAt('')
        setNotes('')
      } else {
        setMeetingAt(toLocalDateTime(getMeetingDate(persistedMeeting)))
      }
      setSuccess(
        clearForm
          ? 'Next meeting updated.'
          : 'Meeting date and time saved.',
      )
    } catch (err) {
      setError(err.message || 'Could not save the meeting.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!meeting?.id) return

    setConfirmingDelete(false)
    setError('')
    setSuccess('')
    setDeleting(true)

    try {
      await deleteNextMeeting()
      setMeeting(null)
      setTitle('')
      setMeetingAt('')
      setNotes('')
      setSuccess('Next meeting deleted.')
    } catch (err) {
      setError(err.message || 'Could not delete the next meeting.')
    } finally {
      setDeleting(false)
    }
  }

  function requestDelete() {
    if (meeting?.id) setConfirmingDelete(true)
  }

  const displayDate = getMeetingDate(meeting)
  const hasSavedMeeting = Boolean(meeting?.id)
  const description = meeting?.description ?? meeting?.notes ?? meeting?.agenda
  const meetingDetails = (
    <section className="feature-card meeting-details">
      {meeting ? (
        <>
          <h2>{meeting.title || 'Group meeting'}</h2>
          {displayDate && (
            <p className="meeting-details__date">
              {new Date(displayDate).toLocaleString('en-KE', {
                dateStyle: 'full',
                timeStyle: 'short',
              })}
            </p>
          )}
          {meeting.location && <p>{meeting.location}</p>}
          {description && <p className="meeting-details__description">{description}</p>}
        </>
      ) : (
        <p className="feature-empty">The next meeting has not been scheduled.</p>
      )}
    </section>
  )
  const meetingActions = canEdit && hasSavedMeeting && (
    <div className="meeting-actions">
      <button
        className="feature-button feature-button--danger meeting-delete-button"
        type="button"
        onClick={requestDelete}
        disabled={saving || deleting}
      >
        {deleting ? 'Deleting…' : 'Delete next meeting'}
      </button>
    </div>
  )

  return (
    <FeaturePage
      title="Meetings"
      description="View the next group meeting and its details."
    >
      {error && <div className="feature-error" role="alert">{error}</div>}
      {success && <div className="feature-success" role="status">{success}</div>}

      {confirmingDelete && meeting && (
        <div className="technical-admin-confirmation-backdrop">
          <section
            className="technical-admin-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="meeting-delete-confirmation-title"
            aria-describedby="meeting-delete-confirmation-description"
          >
            <h2 id="meeting-delete-confirmation-title">Delete meeting?</h2>
            <p id="meeting-delete-confirmation-description">
              Delete the scheduled meeting <strong>{meeting.title}</strong>?
            </p>
            <div className="technical-admin-confirmation-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="feature-button feature-button--danger meeting-delete-button"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete meeting'}
              </button>
            </div>
          </section>
        </div>
      )}

      {loading ? (
        <div className="feature-card" aria-live="polite">Loading meeting details…</div>
      ) : canEdit ? (
        <>
          <form className="feature-card feature-form" onSubmit={handleSave}>
            <label>
              Meeting title
              <input
                className="feature-input"
                type="text"
                name="title"
                value={title}
                onChange={event => setTitle(event.target.value)}
                maxLength={200}
                placeholder="e.g. Monthly group meeting"
                required
              />
            </label>

            <label>
              Meeting date and time
              <span className="feature-date-time-control">
                <input
                  ref={meetingAtInputRef}
                  className="feature-input"
                  type="datetime-local"
                  name="startsAt"
                  value={meetingAt}
                  onChange={event => setMeetingAt(event.target.value)}
                  required
                />
                <button
                  className="feature-button"
                  type="button"
                  aria-label="Open meeting date and time picker"
                  onClick={openMeetingDatePicker}
                >
                  <CalendarDays size={17} aria-hidden="true" />
                  Choose date &amp; time
                </button>
                {hasSavedMeeting && (
                  <button
                    className="feature-button meeting-date-save-button"
                    type="button"
                    aria-label="Save meeting date and time"
                    onClick={handleSaveMeetingDateTime}
                    disabled={saving || deleting || !meetingAt}
                  >
                    <Save size={16} aria-hidden="true" />
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
              </span>
            </label>

            <label>
              Notes or agenda
              <textarea
                className="feature-textarea"
                name="description"
                value={notes}
                onChange={event => setNotes(event.target.value)}
              />
            </label>

            <div>
              <button
                className="feature-button feature-button--primary"
                type="submit"
                disabled={saving || deleting}
              >
                {saving ? 'Saving…' : 'Save next meeting'}
              </button>
            </div>
          </form>
          {meetingDetails}
          {meetingActions}
        </>
      ) : (
        meetingDetails
      )}
    </FeaturePage>
  )
}
