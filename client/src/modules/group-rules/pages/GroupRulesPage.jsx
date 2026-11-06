import { useEffect, useState } from 'react'
import FeaturePage from '../../../shared/components/FeaturePage.jsx'
import {
  getGroupRules,
  saveGroupRules,
} from '../services/groupRulesService.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'

function extractRules(payload) {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return ''

  const value =
    payload.rule?.content ??
    payload.rules ??
    payload.content ??
    payload.text ??
    payload.groupRules ??
    ''

  if (typeof value === 'string') return value

  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string'
          ? item
          : JSON.stringify(item),
      )
      .join('\n')
  }

  return ''
}

export default function GroupRulesPage({ user }) {
  const canEdit =
    String(user?.role ?? '').toLowerCase() === 'chairperson'

  const [rules, setRules] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useAutoDismiss(error, setError)
  useAutoDismiss(success, setSuccess)

  useEffect(() => {
    let active = true

    getGroupRules()
      .then((data) => {
        if (active) setRules(extractRules(data))
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Could not load group rules.')
        }
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
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const result = await saveGroupRules(rules)
      setRules(extractRules(result) || rules)
      setSuccess('Group rules saved.')
    } catch (err) {
      setError(
        err.message ||
        'Could not save group rules. Verify the backend request format.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <FeaturePage
      title="Group rules"
      description="The current rules and agreements for the group."
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
        <div className="feature-card">Loading group rules…</div>
      ) : canEdit ? (
        <form
          className="feature-card feature-form"
          onSubmit={handleSave}
        >
          <label>
            Rules
            <textarea
              className="feature-textarea"
              value={rules}
              onChange={(event) => setRules(event.target.value)}
              required
            />
          </label>

          <div>
            <button
              className="feature-button feature-button--primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save rules'}
            </button>
          </div>
        </form>
      ) : (
        <div className="feature-card">
          {rules ? (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                font: 'inherit',
                margin: 0,
              }}
            >
              {rules}
            </pre>
          ) : (
            <p className="feature-empty">
              No group rules have been added yet.
            </p>
          )}
        </div>
      )}
    </FeaturePage>
  )
}