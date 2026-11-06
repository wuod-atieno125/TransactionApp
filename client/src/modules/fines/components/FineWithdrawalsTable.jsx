

import FineStatusBadge from "./FineStatusBadge";

function FineWithdrawalsTable({
  withdrawals = [],
  loading = false,
  role,
  onView,
  onApprove,
  onReject,
  onExecute,
}) {
  const normalizedRole = role?.toLowerCase();
  const isChairperson = normalizedRole === "chairperson";
  const isTreasurer = normalizedRole === "treasurer";

  if (loading) {
    return <p className="fine-loading">Loading withdrawals...</p>;
  }

  return (
    <div className="fine-table-container">
      <table className="fine-table">
        <thead>
          <tr>
            <th>Withdrawal Number</th>
            <th>Amount</th>
            <th>Purpose</th>
            <th>Initiated By</th>
            <th>Initiated At</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {withdrawals.length === 0 ? (
            <tr>
              <td colSpan="7" className="fine-empty">
                No withdrawal records found.
              </td>
            </tr>
          ) : (
            withdrawals.map((withdrawal) => (
              <tr key={withdrawal.id}>
                <td>{withdrawal.withdrawal_number}</td>

                <td>
                  {withdrawal.currency || "KES"}{" "}
                  {Number(withdrawal.amount || 0).toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                  })}
                </td>

                <td>{withdrawal.purpose}</td>
                <td>{withdrawal.initiated_by_name || "Treasurer"}</td>

                <td>
                  {withdrawal.initiated_at
                    ? new Date(withdrawal.initiated_at).toLocaleDateString()
                    : "—"}
                </td>

                <td>
                  <FineStatusBadge status={withdrawal.status} />
                </td>

                <td>
                  <div className="fine-action-group">
                    {onView && (
                      <button
                        type="button"
                        className="fine-button fine-button-secondary"
                        onClick={() => onView(withdrawal)}
                      >
                        Details
                      </button>
                    )}

                    {isChairperson &&
                      withdrawal.status === "pending" && (
                        <>
                          {onApprove && (
                            <button
                              type="button"
                              className="fine-button fine-button-primary"
                              onClick={() => onApprove(withdrawal)}
                            >
                              Approve
                            </button>
                          )}

                          {onReject && (
                            <button
                              type="button"
                              className="fine-button fine-button-danger"
                              onClick={() => onReject(withdrawal)}
                            >
                              Reject
                            </button>
                          )}
                        </>
                      )}

                    {isTreasurer &&
                      withdrawal.status === "approved" &&
                      onExecute && (
                        <button
                          type="button"
                          className="fine-button fine-button-primary"
                          onClick={() => onExecute(withdrawal)}
                        >
                          Execute
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default FineWithdrawalsTable;
