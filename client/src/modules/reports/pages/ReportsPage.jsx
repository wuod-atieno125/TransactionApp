import { useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '../../../shared/components/PageHeader.jsx'
import {
  getWeeklyGroupReport,
  getWeeklyMemberReport,
} from '../../transactions/services/transactionService.js'
import { formatCurrency } from '../../../shared/utils/formatCurrency.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'

function nairobiToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function currentWeekSunday() {
  const today = nairobiToday()
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - date.getUTCDay())
  return date.toISOString().slice(0, 10)
}

function isSunday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 0
}

function displayDate(value) {
  const date = String(value || '').split('T')[0]
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function addWeeks(value, weeks) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return date.toISOString().slice(0, 10)
}

function weekEndDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 6)
  return date.toISOString().slice(0, 10)
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

export default function ReportsPage({ user }) {
  const canExport = String(user?.role ?? '').toLowerCase() === 'treasurer'
  const thisWeekStart = currentWeekSunday()
  const [weekStart, setWeekStart] = useState(currentWeekSunday)
  const [report, setReport] = useState(null)
  const [memberReport, setMemberReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [groupError, setGroupError] = useState('')
  const [membersError, setMembersError] = useState('')
  const [selectionError, setSelectionError] = useState('')

  useAutoDismiss(groupError, setGroupError)
  useAutoDismiss(membersError, setMembersError)
  useAutoDismiss(selectionError, setSelectionError)

  useEffect(() => {
    let active = true

    getWeeklyGroupReport(weekStart)
      .then(groupResult => {
        if (!active) return
        setReport(groupResult)
      })
      .catch(error => {
        if (!active) return
        setReport(null)
        setGroupError(
          `Group weekly total failed: ${error?.message || 'Unable to load the report.'}`,
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [weekStart])

  function selectWeek(value) {
    if (!isSunday(value)) {
      setSelectionError('Choose a Sunday to load a weekly report.')
      return
    }
    setLoading(true)
    setReport(null)
    setMemberReport(null)
    setGroupError('')
    setMembersError('')
    setSelectionError('')
    setWeekStart(value)
  }

  function handleWeekChange(event) {
    selectWeek(event.target.value)
  }

  async function generateMemberReport() {
    setMembersLoading(true)
    setMembersError('')
    const requestedWeek = weekStart
    try {
      const result = await getWeeklyMemberReport(requestedWeek)
      setMemberReport({
        weekStart: requestedWeek,
        members: Array.isArray(result?.members) ? result.members : [],
      })
    } catch (error) {
      setMembersError(error.message || 'Unable to load the member breakdown.')
    } finally {
      setMembersLoading(false)
    }
  }

  const members = memberReport?.weekStart === weekStart
    ? memberReport.members
    : null
  const chartMembers = members
    ? [...members]
      .sort((first, second) =>
        Number(second.contributionTotal || 0) - Number(first.contributionTotal || 0),
      )
      .slice(0, 8)
    : []
  const maximumContribution = Math.max(
    0,
    ...chartMembers.map(member => Number(member.contributionTotal || 0)),
  )

  function exportReport() {
    if (!report) return

    const memberTable = members ? `
      <h2>Contribution by member</h2>
      <table>
        <thead><tr><th>Member</th><th>Payments</th><th>Contribution total</th></tr></thead>
        <tbody>${members.map(member => `
          <tr>
            <td>${escapeHtml(member.memberName)}</td>
            <td>${escapeHtml(Number(member.transactionCount || 0).toLocaleString('en-KE'))}</td>
            <td>${escapeHtml(formatCurrency(member.contributionTotal))}</td>
          </tr>`).join('') || '<tr><td colspan="3">No active contributions were recorded for this week.</td></tr>'}
        </tbody>
      </table>` : ''
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setMembersError('Allow pop-ups to export the report as a PDF.')
      return
    }

    printWindow.document.open()
    printWindow.document.write(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Weekly contributions ${escapeHtml(weekStart)}</title>
          <style>
            @page { size: A4; margin: 18mm; }
            body { color: #172033; font: 12px Arial, sans-serif; }
            h1 { margin: 0 0 6px; font-size: 23px; }
            h2 { margin: 28px 0 10px; font-size: 16px; }
            p { color: #526078; }
            .summary { display: flex; gap: 40px; margin: 24px 0; }
            .summary strong { display: block; margin-top: 6px; font-size: 18px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 9px 8px; border-bottom: 1px solid #d7deea; text-align: left; }
            th { background: #f1f4f8; }
            @media print { thead { display: table-header-group; } tr { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <h1>Weekly contributions</h1>
          <p>${escapeHtml(displayDate(report.weekStart))} – ${escapeHtml(displayDate(weekEnd))} · Africa/Nairobi time</p>
          <section class="summary">
            <div>Group contributions<strong>${escapeHtml(formatCurrency(report.contributionTotal))}</strong></div>
            <div>Active payments<strong>${escapeHtml(Number(report.transactionCount || 0).toLocaleString('en-KE'))}</strong></div>
          </section>
          ${memberTable}
        </body>
      </html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const weekEnd = report?.weekEnd || `${weekStart}T00:00:00.000Z`

  return (
    <>
      <PageHeader
        eyebrow="INSIGHTS & EXPORTS"
        title="Weekly contributions"
        description="Review weekly group contributions. Generate the individual member breakdown when needed."
        action={canExport ? (
          <button
            className="primary-button"
            type="button"
            onClick={exportReport}
            disabled={!report || loading}
          >
            ↓ Export PDF
          </button>
        ) : null}
      />

      <section className="content-card weekly-report-controls">
        <div className="weekly-report-controls-heading">
          <span className="weekly-report-calendar-icon" aria-hidden="true">
            <CalendarDays size={18} />
          </span>
          <div>
            <h2>Choose a week</h2>
            <p>Browse group contributions by week.</p>
          </div>
        </div>
        <div className="weekly-week-selector">
          <button
            className="weekly-week-nav"
            type="button"
            aria-label="Previous week"
            onClick={() => selectWeek(addWeeks(weekStart, -1))}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <div className="weekly-week-display" aria-live="polite">
            <span>{weekStart === thisWeekStart ? 'THIS WEEK' : 'WEEK OF'}</span>
            <strong>{displayDate(weekStart)} – {displayDate(weekEndDate(weekStart))}</strong>
          </div>
          <button
            className="weekly-week-nav"
            type="button"
            aria-label="Next week"
            onClick={() => selectWeek(addWeeks(weekStart, 1))}
            disabled={weekStart >= thisWeekStart}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <label className="weekly-date-picker" htmlFor="weekly-report-start">
            <span>Jump to Sunday</span>
            <input
              id="weekly-report-start"
              type="date"
              value={weekStart}
              max={thisWeekStart}
              onChange={handleWeekChange}
              aria-describedby="weekly-report-help"
            />
          </label>
        </div>
        <p id="weekly-report-help">
          Reports cover Sunday through Saturday in Africa/Nairobi time. Reversed payments are excluded.
        </p>
      </section>

      {selectionError && <p className="app-error" role="alert">{selectionError}</p>}
      {groupError && <p className="app-error" role="alert">{groupError}</p>}
      {membersError && <p className="app-error" role="alert">{membersError}</p>}

      {loading ? (
        <section className="content-card" aria-live="polite">Loading weekly contributions…</section>
      ) : (
        <>
          {report && (
            <section className="stat-grid weekly-report-summary">
              <article className="stat-card stat-dark">
                <small>Group contributions</small>
                <strong>{formatCurrency(report.contributionTotal)}</strong>
                <span>{Number(report.transactionCount || 0).toLocaleString('en-KE')} active payments</span>
              </article>
              <article className="stat-card">
                <small>Week</small>
                <strong>{displayDate(report.weekStart)} – {displayDate(weekEnd)}</strong>
                <span>Africa/Nairobi time</span>
              </article>
              {members && (
                <article className="stat-card">
                  <small>Contributing members</small>
                  <strong>{members.length.toLocaleString('en-KE')}</strong>
                  <span>Members with at least one active payment</span>
                </article>
              )}
            </section>
          )}

          <section className="content-card">
            <div className="card-heading">
              <div>
                <h2>Contribution by member</h2>
                <p>Generate this individual breakdown when you need it.</p>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={generateMemberReport}
                disabled={membersLoading || loading}
              >
                {membersLoading ? 'Generating…' : members ? 'Refresh individual report' : 'Generate individual report'}
              </button>
            </div>
            {membersLoading ? (
              <p aria-live="polite">Generating individual contributions…</p>
            ) : members ? (
            <>
            {chartMembers.length > 0 && (
              <section
                className="weekly-member-chart"
                aria-label="Top member contributions"
              >
                <div className="weekly-member-chart-heading">
                  <div>
                    <h3>Top contributions</h3>
                    <p>Highest contributing members for the selected week.</p>
                  </div>
                  <span>TOP {chartMembers.length}</span>
                </div>
                <div className="weekly-member-chart-bars" role="list">
                  {chartMembers.map((member, index) => {
                    const amount = Number(member.contributionTotal || 0)
                    const width = maximumContribution > 0
                      ? Math.max((amount / maximumContribution) * 100, amount > 0 ? 2 : 0)
                      : 0
                    return (
                      <div
                        className="weekly-member-chart-row"
                        key={member.memberUserId || member.memberName}
                        role="listitem"
                        aria-label={`${member.memberName}: ${formatCurrency(amount)}`}
                      >
                        <span className="weekly-member-chart-rank">{index + 1}</span>
                        <span className="weekly-member-chart-name" title={member.memberName}>
                          {member.memberName}
                        </span>
                        <span className="weekly-member-chart-track" aria-hidden="true">
                          <span
                            className="weekly-member-chart-bar"
                            style={{ width: `${width}%` }}
                          />
                        </span>
                        <strong>{formatCurrency(amount)}</strong>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
            <div className="feature-table-wrap">
              <table className="feature-table">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Payments</th>
                    <th scope="col">Contribution total</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.memberUserId || member.memberName}>
                      <td>{member.memberName}</td>
                      <td>{Number(member.transactionCount || 0).toLocaleString('en-KE')}</td>
                      <td>{formatCurrency(member.contributionTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {members.length === 0 && (
                <p className="feature-empty">No active contributions were recorded for this week.</p>
              )}
            </div>
            </>
            ) : (
              <p className="feature-empty">The individual contribution report has not been generated.</p>
            )}
          </section>
        </>
      )}
    </>
  )
}
