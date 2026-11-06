

function FinePaymentsTable({ payments = [], loading = false }) {
  if (loading) {
    return <p className="fine-loading">Loading fine payments...</p>;
  }

  return (
    <div className="fine-table-container">
      <table className="fine-table">
        <thead>
          <tr>
            <th>Payment Number</th>
            <th>Fine Number</th>
            <th>Member</th>
            <th>Amount</th>
            <th>Payment Method</th>
            <th>Reference</th>
            <th>Payment Date</th>
          </tr>
        </thead>

        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan="7" className="fine-empty">
                No fine payments recorded.
              </td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr key={payment.id}>
                <td>{payment.payment_number}</td>
                <td>{payment.fine_number}</td>
                <td>{payment.member_name || "Member"}</td>
                <td>
                  {payment.currency || "KES"}{" "}
                  {Number(payment.amount || 0).toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td>
                  {String(payment.payment_method || "")
                    .replace(/_/g, " ")
                    .toUpperCase()}
                </td>
                <td>{payment.payment_reference || "—"}</td>
                <td>
                  {payment.payment_date
                    ? new Date(payment.payment_date).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default FinePaymentsTable;
