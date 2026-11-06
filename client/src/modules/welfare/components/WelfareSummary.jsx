import { ArrowUpRight, HeartHandshake, ShieldCheck, Users } from 'lucide-react'
import { formatCurrency } from '../../../shared/utils/formatCurrency.js'

function valueOrZero(value) {
  return Number(value || 0)
}

export default function WelfareSummary({ balance, statement, requirement, withdrawals = [] }) {
  const totalBalance = valueOrZero(balance?.balance)
  const totalContributions = valueOrZero(balance?.total_contributions)
  const personalBalance = valueOrZero(statement?.balance)
  const pendingWithdrawals = withdrawals.filter(item => item.status === 'pending').length
  const coverage = totalContributions > 0
    ? Math.min(100, Math.round((totalBalance / totalContributions) * 100))
    : 0

  return (
    <section className="welfare-overview" aria-label="Welfare fund overview">
      <div className="welfare-hero-card">
        <div className="welfare-hero-copy">
          <span className="welfare-kicker"><HeartHandshake size={15} /> COMMUNITY CARE FUND</span>
          <h2>Building a stronger safety net together.</h2>
          <p>
            Track the fund that supports members through shared responsibility,
            transparent records, and timely assistance.
          </p>
        </div>
        <div className="welfare-hero-mark" aria-hidden="true">♥</div>
      </div>

      <div className="welfare-metric-grid">
        <article className="welfare-metric-card welfare-metric-card--primary">
          <span className="welfare-metric-label">Available welfare fund</span>
          <strong>{formatCurrency(totalBalance)}</strong>
          <small><ArrowUpRight size={14} /> Current collective balance</small>
        </article>
        <article className="welfare-metric-card">
          <span className="welfare-metric-label">Your welfare balance</span>
          <strong>{formatCurrency(personalBalance)}</strong>
          <small><ShieldCheck size={14} /> Your recorded share</small>
        </article>
        <article className="welfare-metric-card">
          <span className="welfare-metric-label">Active member support</span>
          <strong>{coverage}%</strong>
          <small><Users size={14} /> Fund retention level</small>
        </article>
        <article className="welfare-metric-card">
          <span className="welfare-metric-label">Requests in review</span>
          <strong>{pendingWithdrawals}</strong>
          <small>Withdrawal approvals pending</small>
        </article>
      </div>

      <div className="welfare-insight-grid">
        <article className="welfare-insight-card">
          <div>
            <span className="welfare-metric-label">Contribution rhythm</span>
            <strong>{formatCurrency(requirement?.amount)} <small>required per member</small></strong>
          </div>
          <p>Consistent contributions keep the community ready when support is needed.</p>
          <div className="welfare-progress" aria-label={`${coverage}% of contributions retained`}>
            <span style={{ width: `${coverage}%` }} />
          </div>
        </article>
        <article className="welfare-insight-card welfare-insight-card--warm">
          <span className="welfare-metric-label">Welfare focus</span>
          <strong>Care, dignity, and accountability.</strong>
          <p>Every entry is recorded so members can see how the shared fund is growing and being stewarded.</p>
        </article>
      </div>
    </section>
  )
}
