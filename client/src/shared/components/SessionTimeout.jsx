import { useEffect, useRef, useState } from 'react'

const IDLE_TIMEOUT_MS = 10 * 60 * 1000
const WARNING_LEAD_MS = 2 * 60 * 1000
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove']

export default function SessionTimeout({ userId, onExtend, onLogout, onExpire, loggingOut = false }) {
  const lastActivityRef = useRef(null)
  const warningRef = useRef(false)
  const callbacksRef = useRef({ onExtend, onExpire })
  const [warning, setWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [extending, setExtending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    callbacksRef.current = { onExtend, onExpire }
  }, [onExtend, onExpire])

  useEffect(() => {
    lastActivityRef.current = Date.now()
    let expired = false

    function updateIdleState() {
      const elapsed = Date.now() - lastActivityRef.current
      const remaining = IDLE_TIMEOUT_MS - elapsed

      if (remaining <= 0) {
        if (!expired) {
          expired = true
          callbacksRef.current.onExpire()
        }
        return
      }

      if (remaining <= WARNING_LEAD_MS) {
        warningRef.current = true
        setWarning(true)
        setRemainingSeconds(Math.ceil(remaining / 1000))
      }
    }

    function recordActivity() {
      if (expired) return
      lastActivityRef.current = Date.now()
      if (warningRef.current) {
        warningRef.current = false
        setWarning(false)
        setRemainingSeconds(0)
      }
    }

    const intervalId = window.setInterval(updateIdleState, 1000)
    ACTIVITY_EVENTS.forEach(eventName => {
      window.addEventListener(eventName, recordActivity, { passive: true })
    })
    document.addEventListener('visibilitychange', updateIdleState)

    return () => {
      window.clearInterval(intervalId)
      ACTIVITY_EVENTS.forEach(eventName => {
        window.removeEventListener(eventName, recordActivity)
      })
      document.removeEventListener('visibilitychange', updateIdleState)
    }
  }, [userId])

  async function extendSession() {
    setExtending(true)
    setError('')
    try {
      const extended = await callbacksRef.current.onExtend()
      if (!extended) {
        setError('Your session could not be extended. Please log in again.')
        return
      }
      lastActivityRef.current = Date.now()
      warningRef.current = false
      setWarning(false)
      setRemainingSeconds(0)
    } catch (extendError) {
      setError(extendError.message || 'Unable to extend your session.')
    } finally {
      setExtending(false)
    }
  }

  if (!warning) return null

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = String(remainingSeconds % 60).padStart(2, '0')

  return (
    <div className="session-timeout-backdrop">
      <section
        className="session-timeout-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-timeout-title"
        aria-describedby="session-timeout-message"
      >
        <h2 id="session-timeout-title">Still there?</h2>
        <p id="session-timeout-message">
          You’ll be logged out in {minutes}:{seconds} due to inactivity. Stay signed in to keep working, or log out now.
        </p>
        {error && <p className="session-timeout-error" role="alert">{error}</p>}
        <div className="session-timeout-actions">
          <button type="button" className="secondary-button" onClick={onLogout} disabled={loggingOut}>
            {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
          <button type="button" className="primary-button" onClick={extendSession} disabled={extending}>
            {extending ? 'Extending…' : 'Stay signed in'}
          </button>
        </div>
      </section>
    </div>
  )
}
