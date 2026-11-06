

import FineStatusBadge from "./FineStatusBadge";

function FineRecordsTable({
  records = [],
  loading = false,
  role,
  onView,
  onRecordPayment,
}) {
  const canRecordPayment = role?.toLowerCase() === "treasurer";

  if (loading) {
    return <p className="fine-loading">Loading fine records...</p>;
  }

  return (
    <div className="fine-table-container">
      <table className="fine-table">
        <thead>
          <tr>
            <th>Fine Number</th>
            <th>Member</th>
            <th>Fine Description</th>
            <th>Assessed Amount</th>
            <th>Amount Paid</th>
            <th>Outstanding</th>
            <th>Issue Date</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan="9" className="fine-empty">
                No fine records found.
              </td>
            </tr>
          ) : (
            records.map((record) => (
              <tr key={record.id}>
                <td>{record.fine_number}</td>
                <td>{record.member_name || "Member"}</td>
                <td>{record.rule_title}</td>

                <td>
                  {record.currency || "KES"}{" "}
                  {Number(record.assessed_amount || 0).toLocaleString()}
                </td>

                <td>
                  {record.currency || "KES"}{" "}
                  {Number(record.amount_paid || 0).toLocaleString()}
                </td>

                <td>
                  {record.currency || "KES"}{" "}
                  {Number(record.outstanding_amount || 0).toLocaleString()}
                </td>

                <td>
                  {record.issued_at
                    ? new Date(record.issued_at).toLocaleDateString()
                    : "—"}
                </td>

                <td>
                  <FineStatusBadge status={record.status} />
                </td>

                <td>
                  <div className="fine-action-group">
                    {onView && (
                      <button
                        type="button"
                        className="fine-button fine-button-secondary"
                        onClick={() => onView(record)}
                      >
                        Details
                      </button>
                    )}

                    {canRecordPayment &&
                      Number(record.outstanding_amount) > 0 &&
                      onRecordPayment && (
                        <button
                          type="button"
                          className="fine-button fine-button-primary"
                          onClick={() => onRecordPayment(record)}
                        >
                          Record Payment
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

export default FineRecordsTable;
