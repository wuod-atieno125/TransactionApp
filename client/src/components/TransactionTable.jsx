import { useEffect, useState } from 'react'
import Avatar from './ui/Avatar.jsx'
import StatusBadge from './ui/StatusBadge.jsx'
import { formatCurrency } from '../utils/formatCurrency.js'

export default function TransactionTable({
  rows,
  canReverse = false,
  canRequestReversal = false,
  onReverse,
}) {
  const [now, setNow] = useState(() => Date.now())
  const showAction = canReverse || canRequestReversal

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
      const status = row.status === 'reversed' ? 'Reversed' : 'Received'
      const reversalRequestStatus = row.reversal_request_status
      const reversalStatus = {
        pending: 'Submitted',
        pending_treasurer: 'Submitted',
        pending_chairperson: 'Under review',
        approved: 'Approved',
        rejected: 'Rejected',
      }[reversalRequestStatus]
      const reversalTone = reversalRequestStatus === 'rejected'
        ? 'danger'
        : reversalRequestStatus === 'pending' ||
            reversalRequestStatus === 'pending_treasurer' ||
            reversalRequestStatus === 'pending_chairperson'
          ? 'warning'
          : 'success'
      const requestPending = reversalRequestStatus === 'pending' ||
        reversalRequestStatus === 'pending_treasurer' ||
        reversalRequestStatus === 'pending_chairperson'
      const memberReversalExpired = canRequestReversal && (
        row.member_reversal_allowed === false ||
        (row.created_at &&
          now >= new Date(row.created_at).getTime() + 15 * 60 * 1000)
      )

      return (
        <tr key={row.id || reference}>
          <td><span className="person-cell"><Avatar name={name}/>{name}</span></td>
          <td><code>{reference}</code></td>
          <td>{date}</td>
          <td className="amount">{formatCurrency(row.amount)}</td>
          <td>
            <StatusBadge tone={status === 'Reversed' ? 'danger' : 'success'}>{status}</StatusBadge>
            {reversalStatus && (
              <div className="transaction-reversal-status">
                <StatusBadge tone={reversalTone}>{reversalStatus}</StatusBadge>
              </div>
            )}
          </td>
          {showAction && (
            <td>
              {row.status === 'active' && !requestPending ? (
                <button
                  className="transaction-reverse-button"
                  type="button"
                  onClick={() => onReverse?.(row)}
                  disabled={memberReversalExpired}
                  title={memberReversalExpired
                    ? 'Members can only request a reversal within 15 minutes of the transaction being recorded.'
                    : undefined}
                >
                  {canRequestReversal
                    ? memberReversalExpired
                      ? 'Reverse disabled'
                      : reversalRequestStatus === 'rejected'
                        ? 'Request reversal again'
                        : 'Request reversal'
                    : row.reversal_approval_required
                    ? 'Request approval'
                    : 'Reverse'}
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
