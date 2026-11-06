import { useEffect, useState } from 'react'
import Avatar from '../../../shared/components/ui/Avatar.jsx'
import StatusBadge from '../../../shared/components/ui/StatusBadge.jsx'
import { formatCurrency } from '../../../shared/utils/formatCurrency.js'

export default function TransactionTable({
  rows,
  canReverse = false,
  canRequestReversal = false,
  onReverse,
}) {
  const [now, setNow] = useState(() => Date.now())
  const showAction = canReverse || canRequestReversal || rows.some(row => row.can_request_reversal)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return <div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>M-PESA CODE</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th>{showAction && <th>ACTION</th>}</tr></thead><tbody>
    {rows.map(row => {
      const name = row.entered_member_name || row.name || 'Unknown member'
      const reference = row.mpesa_reference || row.reference || '—'
      const paidAt = row.paid_at || row.date
      const date = paidAt
        ? new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium' }).format(new Date(paidAt))
        : '—'
      const baseStatus = row.status === 'reversed' ? 'Reversed' : 'Received'
      const reversalRequestStatus = row.reversal_request_status
      const reversalStatus = {
        pending: 'Submitted',
        pending_treasurer: 'Submitted',
        pending_chairperson: 'Under review',
      }[reversalRequestStatus]
      const reversalTone = 'warning'
      const reviewedAt = row.reversal_reviewed_at
        ? new Date(row.reversal_reviewed_at).getTime()
        : NaN
      const decisionIsRecent = (
        ['approved', 'rejected'].includes(reversalRequestStatus) &&
        Number.isFinite(reviewedAt) &&
        now >= reviewedAt &&
        now < reviewedAt + 24 * 60 * 60 * 1000
      )
      const status = decisionIsRecent
        ? reversalRequestStatus === 'approved' ? 'Approved' : 'Rejected'
        : baseStatus
      const statusTone = decisionIsRecent
        ? reversalRequestStatus === 'rejected' ? 'danger' : 'success'
        : status === 'Reversed' ? 'danger' : 'success'
      const requestPending = reversalRequestStatus === 'pending' ||
        reversalRequestStatus === 'pending_treasurer' ||
        reversalRequestStatus === 'pending_chairperson'
      const reversalExpired = (
        row.reversal_allowed === false ||
        (row.created_at &&
          now >= new Date(row.created_at).getTime() + 12 * 60 * 60 * 1000)
      )
      const canRequestThisReversal = canRequestReversal
        ? row.can_request_reversal !== false
        : row.can_request_reversal === true

      return (
        <tr key={row.id || reference}>
          <td><span className="person-cell"><Avatar name={name}/>{name}</span></td>
          <td><code>{reference}</code></td>
          <td>{date}</td>
          <td className="amount">{formatCurrency(row.amount)}</td>
          <td>
            <StatusBadge tone={statusTone}>{status}</StatusBadge>
            {reversalStatus && (
              <div className="transaction-reversal-status">
                <StatusBadge tone={reversalTone}>{reversalStatus}</StatusBadge>
              </div>
            )}
          </td>
          {showAction && (
            <td>
              {row.status === 'active' && !requestPending && (canReverse || canRequestThisReversal) ? (
                <button
                  className="transaction-reverse-button"
                  type="button"
                  onClick={() => onReverse?.(row)}
                  disabled={reversalExpired}
                  title={reversalExpired
                    ? 'Reversal requests are only allowed within 12 hours of the welfare transaction being recorded.'
                    : undefined}
                >
                  {canRequestThisReversal && !canReverse
                    ? reversalExpired
                      ? 'Reverse disabled'
                      : reversalRequestStatus === 'rejected'
                        ? 'Request reversal again'
                        : 'Request reversal'
                    : reversalExpired ? 'Reversal disabled' : 'Request approval'}
                </button>
              ) : (
                <span className="transaction-action-muted">
                  {requestPending ? 'Under review' : '—'}
                </span>
              )}
            </td>
          )}
        </tr>
      )
    })}
  </tbody></table>{rows.length === 0 && <p className="empty-state">No records to show.</p>}</div>
}
