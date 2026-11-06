import { useEffect, useState } from 'react'
import PageHeader from '../../../shared/components/PageHeader.jsx'
import TransactionTable from '../../transactions/components/TransactionTable.jsx'
import { getTransactions } from '../../transactions/services/transactionService.js'
import { getDashboardOverview } from '../services/dashboardService.js'
import { getPaymentDestination } from '../../group-management/services/paymentDestinationService.js'
import { getNextMeeting } from '../../meetings/services/meetingsService.js'
import { formatCurrency } from '../../../shared/utils/formatCurrency.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'

function displayDate() {
  return new Intl.DateTimeFormat('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

function getUserName(user) {
  return (
    user?.fullName ||
    user?.full_name ||
    user?.name ||
    user?.firstName ||
    user?.first_name ||
    'there'
  )
}

function unwrapMeeting(payload) {
  return payload?.meeting ?? payload?.nextMeeting ?? payload?.next_meeting ?? payload
}

function meetingStart(meeting) {
  const value = meeting?.startsAt ?? meeting?.starts_at ?? meeting?.meetingAt ??
    meeting?.meeting_at ?? meeting?.meetingDate ?? meeting?.meeting_date ?? meeting?.date
  const timestamp = value ? new Date(value).getTime() : NaN
  return Number.isFinite(timestamp) ? timestamp : null
}

function formatCountdown(target, now) {
  if (!target) return 'Not scheduled'
  const remaining = target - now
  if (remaining <= 0) return 'Meeting time reached'
  const days = Math.floor(remaining / 86400000)
  const hours = Math.floor((remaining % 86400000) / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
}

function getOverviewStats(overview, role) {
  const dashboard = overview?.dashboard || overview || {}
  const contributions =
    dashboard.contributions || dashboard

  const members = dashboard.members || {}

  if (['member', 'secretary'].includes(role)) {
    return [
      {
        label: 'My contributions',
        visual: 'sparkline',
        value: formatCurrency(
          contributions.total_contributions ?? 0,
        ),
        detail: 'Total recorded contributions',
      },
      {
        label: 'Collective contributions',
        visual: 'donut',
        value: formatCurrency(
          contributions.collective_total_contributions ?? 0,
        ),
        detail: 'Total active group contributions',
        dark: true,
      },
      {
        label: 'My welfare contributions',
        visual: 'bars',
        value: Number(
          contributions.active_transaction_count ?? 0,
        ).toLocaleString('en-KE'),
        detail: 'Active welfare contribution records',
      },
      {
        label: 'Reversed welfare contributions',
        value: Number(
          contributions.reversed_transaction_count ?? 0,
        ).toLocaleString('en-KE'),
        detail: 'Transactions reversed',
      },
      {
        label: 'Pending withdrawals',
        value: Number(
          contributions.pending_welfare_withdrawals ?? 0,
        ).toLocaleString('en-KE'),
        detail: 'Welfare requests awaiting chairperson review',
      },
    ]
  }

  return [
    {
      label: 'Collective contributions',
      visual: 'donut',
      value: formatCurrency(
        contributions.total_contributions ?? 0,
      ),
      detail: 'Total active contributions recorded',
      dark: true,
    },
    {
      label: 'Active welfare contributions',
      visual: 'bars',
      value: Number(
        contributions.active_transaction_count ?? 0,
      ).toLocaleString('en-KE'),
      detail: 'Recorded welfare contribution records',
    },
    {
      label: 'Approved members',
      value: Number(
        members.approved_members ?? 0,
      ).toLocaleString('en-KE'),
      detail: 'Approved group members',
    },
  ]
}

export default function DashboardPage({ user, onNavigate }) {
  const role = String(user?.role || 'member')
    .toLowerCase()
    .replace(/\s+/g, '')

  const canRecordPayment = role === 'treasurer'
  const showAccountMeetingSummary = ['member', 'chairperson', 'treasurer'].includes(role)

  const [overview, setOverview] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paymentDestination, setPaymentDestination] = useState(null)
  const [nextMeeting, setNextMeeting] = useState(null)
  const [now, setNow] = useState(0)

  useAutoDismiss(error, setError)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError('')

      try {
        const requests = [
          getDashboardOverview(),
          getTransactions({ limit: 5, offset: 0 }),
        ]
        if (showAccountMeetingSummary) requests.push(getPaymentDestination())

        const results = await Promise.allSettled(requests)

        if (!active) return

        const [overviewResult, transactionsResult] = results
        const paymentResult = results[2]

        if (overviewResult.status === 'fulfilled') {
          setOverview(overviewResult.value)
        } else {
          setError(
            overviewResult.reason?.message ||
              'Unable to load dashboard statistics.',
          )
        }

        if (transactionsResult.status === 'fulfilled') {
          setTransactions(
            transactionsResult.value.transactions,
          )
        } else if (overviewResult.status === 'fulfilled') {
          setError(
            transactionsResult.reason?.message ||
              'Dashboard statistics loaded, but recent transactions could not be loaded.',
          )
        }

        if (paymentResult?.status === 'fulfilled') {
          setPaymentDestination(paymentResult.value)
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.message ||
              'Unable to load dashboard information.',
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [showAccountMeetingSummary])

  useEffect(() => {
    if (!showAccountMeetingSummary) return undefined

    let active = true
    const refreshMeeting = () => {
      getNextMeeting()
        .then(payload => {
          if (active) {
            setNow(Date.now())
            setNextMeeting(unwrapMeeting(payload))
          }
        })
        .catch(() => {
          if (active) setNextMeeting(null)
        })
    }

    refreshMeeting()
    const meetingRefresh = window.setInterval(refreshMeeting, 30000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      active = false
      window.clearInterval(meetingRefresh)
      window.clearInterval(clock)
    }
  }, [showAccountMeetingSummary])

  const stats = overview
    ? getOverviewStats(overview, role)
    : []

  return (
    <>
      <PageHeader
        eyebrow={displayDate().toUpperCase()}
        title={`Good day, ${getUserName(user)}`}
        description="Here's what's happening with your group today."
        action={
          showAccountMeetingSummary ? (
            <div className="member-dashboard-summary">
              <div className="member-summary-item member-summary-account">
                <span>TRANSACTION ACCOUNT</span>
                <strong>{paymentDestination?.paymentNumber || 'Not added yet'}</strong>
              </div>
              <div className="member-summary-item member-summary-countdown" aria-live="off">
                <span>NEXT MEETING</span>
                <strong>{formatCountdown(meetingStart(nextMeeting), now)}</strong>
              </div>
            </div>
          ) : canRecordPayment ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => onNavigate?.('welfareContributions')}
            >
              ＋ Record payment
            </button>
          ) : null
        }
      />

      {error && (
        <p className="app-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <section className="content-card" aria-live="polite">
          <p>Loading dashboard information…</p>
        </section>
      ) : (
        <>
          <section className={`stat-grid${['member', 'secretary'].includes(role) ? ' stat-grid-member' : ''}`}>
            {stats.map((stat) => (
              <article
                key={stat.label}
                className={`stat-card${stat.dark ? ' stat-dark' : ''}`}
              >
                <small>{stat.label}</small>
                {stat.visual === 'sparkline' && (
                  <svg className="stat-visual stat-visual-sparkline" viewBox="0 0 100 38" aria-hidden="true">
                    <path d="M2 31 17 25 29 29 43 18 55 22 70 11 81 14 98 3" />
                    <circle cx="98" cy="3" r="3" />
                  </svg>
                )}
                {stat.visual === 'donut' && (
                  <span className="stat-visual stat-visual-donut" aria-hidden="true" />
                )}
                {stat.visual === 'bars' && (
                  <span className="stat-visual stat-visual-bars" aria-hidden="true">
                    <i /><i /><i /><i />
                  </span>
                )}
                <strong>{stat.value}</strong>
                <span>{stat.detail}</span>
              </article>
            ))}
          </section>

          <section className="content-card">
            <div className="card-heading">
              <div>
                <h2>Recent transactions</h2>
                <p>
                  {['member', 'secretary'].includes(role)
                    ? 'Your recent contribution transactions.'
                    : 'Latest contribution transactions recorded for your group.'}
                </p>
              </div>

              <button
                type="button"
                className="link-button"
                onClick={() => onNavigate?.('welfareContributions')}
              >
                View all →
              </button>
            </div>

            {transactions.length > 0 ? (
              <TransactionTable rows={transactions} />
            ) : (
              <p className="empty-state">
                No recent transactions are available.
              </p>
            )}
          </section>
        </>
      )}
    </>
  )
}
