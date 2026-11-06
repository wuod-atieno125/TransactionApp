import { useEffect, useState } from 'react'
import FeaturePage from '../../../shared/components/FeaturePage.jsx'
import { getMyAccount } from '../services/memberService.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'

function show(value) {
  if (value === undefined || value === null || value === '') {
    return 'Not provided'
  }

  return String(value)
}

export default function ProfilePage({ embedded = false }) {
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useAutoDismiss(error, setError)

  useEffect(() => {
    let active = true

    getMyAccount()
      .then(result => {
        if (active) setAccount(result)
      })
      .catch(requestError => {
        if (active) {
          setError(requestError.message || 'Unable to load your profile.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const content = (
    <>
      {error && (
        <div className="feature-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="feature-card" aria-live="polite">
          Loading profile…
        </div>
      ) : account ? (
        <div className="feature-card">
          <div className="feature-grid">
            <div>
              <p className="feature-muted">Full name</p>
              <strong>{show(account.fullName)}</strong>
            </div>

            <div>
              <p className="feature-muted">Username</p>
              <strong>{show(account.username)}</strong>
            </div>

            <div>
              <p className="feature-muted">Phone</p>
              <strong>{show(account.phone)}</strong>
            </div>

            <div>
              <p className="feature-muted">Email</p>
              <strong>{show(account.recoveryEmail)}</strong>
            </div>

            <div>
              <p className="feature-muted">Role</p>
              <strong>{show(account.role)}</strong>
            </div>

            <div>
              <p className="feature-muted">Account ID</p>
              <strong>{show(account.id)}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )

  return embedded ? (
    content
  ) : (
    <FeaturePage
      title="My account"
      description="Review the account currently signed in to GCMS."
    >
      {content}
    </FeaturePage>
  )
}
