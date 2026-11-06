import { useEffect, useState } from 'react'
import FeaturePage from '../../../shared/components/FeaturePage.jsx'
import {
  createMeetingMinutes,
  getMeetingMinutes,
  updateMeetingMinutes,
} from '../services/meetingMinutesService.js'
import { getMeetings } from '../services/meetingsService.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'

const itemId = (item) =>
  item?.id ?? item?.minuteId ?? item?.minute_id

const itemTitle = (item) =>
  item?.title ??
  item?.meetingTitle ??
  item?.meeting_title ??
  'Meeting minutes'

const itemDate = (item) =>
  item?.meeting_starts_at ??
  item?.meetingDate ??
  item?.meeting_date ??
  item?.date ??
  item?.createdAt ??
  item?.created_at

const itemContent = (item) =>
  item?.content ??
  item?.minutes ??
  item?.body ??
  item?.notes ??
  ''

const meetingHasTakenPlace = item => {
  const startsAt = itemDate(item)
  return startsAt ? new Date(startsAt).getTime() <= Date.now() : false
}

export default function MeetingMinutesPage({ user }) {
  const canEdit =
    String(user?.role ?? '').toLowerCase() === 'secretary'

  const [items, setItems] = useState([])
  const [meetings, setMeetings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [meetingId, setMeetingId] = useState('')
  const [content, setContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useAutoDismiss(error, setError)
  useAutoDismiss(success, setSuccess)

  async function reload() {
    const result = await getMeetingMinutes()
    setItems(result)
  }

  useEffect(() => {
    let active = true

    Promise.allSettled([
      getMeetingMinutes(),
      canEdit ? getMeetings() : Promise.resolve([]),
    ])
      .then(([minutesResult, meetingsResult]) => {
        if (!active) return

        if (minutesResult.status === 'fulfilled') {
          setItems(minutesResult.value)
        } else {
          setError(minutesResult.reason?.message || 'Could not load meeting minutes.')
        }

        if (meetingsResult.status === 'fulfilled') {
          setMeetings(meetingsResult.value)
        } else {
          setError(meetingsResult.reason?.message || 'Could not load meetings.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [canEdit])

  function startNew() {
    setSelectedId(null)
    setMeetingId('')
    setContent('')
    setEditing(true)
    setError('')
    setSuccess('')
  }

  function selectItem(item) {
    setSelectedId(itemId(item))
    setMeetingId(String(item.meeting_id ?? item.meetingId ?? ''))
    setContent(itemContent(item))
    setEditing(false)
    setError('')
    setSuccess('')
  }

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      if (selectedId) {
        await updateMeetingMinutes(selectedId, { content })
      } else {
        await createMeetingMinutes({ meetingId, content })
      }

      await reload()
      setEditing(false)

      setSuccess(
        selectedId
          ? 'Meeting minutes updated.'
          : 'Meeting minutes created.',
      )
    } catch (err) {
      setError(
        err.message ||
        'Could not save minutes. Check the backend request format.',
      )
    } finally {
      setSaving(false)
    }
  }

  const selected = items.find(
    (item) => String(itemId(item)) === String(selectedId),
  )
  const availableMeetings = meetings.filter(meeting => !meeting.has_minutes)

  return (
    <FeaturePage
      title="Meeting minutes"
      description={
        canEdit
          ? 'Read, create and edit meeting records.'
          : 'Read the official records of group meetings.'
      }
      actions={
        canEdit ? (
          <button
            className="feature-button feature-button--primary"
            onClick={startNew}
          >
            New minutes
          </button>
        ) : null
      }
    >
      {error && (
        <div className="feature-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="feature-success" role="status">
          {success}
        </div>
      )}

      {loading ? (
        <div className="feature-card">
          Loading meeting minutes…
        </div>
      ) : (
        <div
          className="feature-grid meeting-minutes-grid"
        >
          <div className="feature-card">
            <h2 style={{ marginTop: 0 }}>Records</h2>

            {items.length === 0 ? (
              <p className="feature-empty">
                No meeting minutes are available.
              </p>
            ) : (
              items.map((item, index) => (
                <button
                  key={itemId(item) ?? index}
                  className="feature-button"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    marginBottom: '.5rem',
                  }}
                  onClick={() => selectItem(item)}
                >
                  <strong style={{ display: 'block' }}>
                    {itemTitle(item)}
                  </strong>

                  <span className="feature-muted">
                    {itemDate(item)
                      ? new Date(itemDate(item)).toLocaleDateString('en-KE')
                      : 'Date not provided'}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="feature-card">
            {editing && canEdit ? (
              <form
                className="feature-form"
                onSubmit={handleSave}
              >
                {selectedId ? (
                  <p className="feature-muted">
                    Meeting: {itemTitle(selected)}
                    {itemDate(selected)
                      ? ` — ${new Date(itemDate(selected)).toLocaleDateString('en-KE')}`
                      : ''}
                  </p>
                ) : (
                  <label>
                    Meeting
                    <select
                      className="feature-select"
                      value={meetingId}
                      onChange={event => setMeetingId(event.target.value)}
                      required
                    >
                      <option value="">Select a meeting</option>
                      {availableMeetings.map(meeting => (
                        <option key={meeting.id} value={meeting.id}>
                          {meeting.title} — {new Date(meeting.starts_at).toLocaleString('en-KE', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </option>
                      ))}
                    </select>
                    {availableMeetings.length === 0 && (
                      <span className="feature-muted">
                        No meetings without recorded minutes are available.
                      </span>
                    )}
                  </label>
                )}

                <label>
                  Minutes
                  <textarea
                    className="feature-textarea"
                    value={content}
                    onChange={(event) =>
                      setContent(event.target.value)
                    }
                    required
                  />
                </label>

                <div className="meeting-minutes-form-actions">
                  <button
                    className="feature-button feature-button--primary"
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save minutes'}
                  </button>

                  <button
                    type="button"
                    className="feature-button"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : selected ? (
              <>
                <h2 style={{ marginTop: 0 }}>
                  {itemTitle(selected)}
                </h2>

                <p className="feature-muted">
                  {itemDate(selected)
                    ? new Date(itemDate(selected)).toLocaleDateString('en-KE')
                    : 'Date not provided'}
                </p>

                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {itemContent(selected) || 'No content recorded.'}
                </div>

                {canEdit && meetingHasTakenPlace(selected) && (
                  <div style={{ marginTop: '1rem' }}>
                    <button
                      className="feature-button"
                      onClick={() => setEditing(true)}
                    >
                      Edit minutes
                    </button>
                  </div>
                )}
                {canEdit && !meetingHasTakenPlace(selected) && (
                  <p className="feature-muted">
                    Minutes can only be edited after the meeting has taken place.
                  </p>
                )}
              </>
            ) : (
              <p className="feature-empty">
                Select a record to read it
                {canEdit ? ' or create new minutes' : ''}.
              </p>
            )}
          </div>
        </div>
      )}
    </FeaturePage>
  )
}