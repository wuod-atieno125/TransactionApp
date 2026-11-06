

import FineStatusBadge from "./FineStatusBadge";

function formatAmount(amount, currency = "KES") {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDate(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleString("en-KE");
}

function FineDetailsModal({ fine, onClose }) {
  if (!fine) return null;

  return (
    <div
      className="fine-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section
        className="fine-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fine-modal-title"
      >
        <div className="fine-modal-header">
          <h3 id="fine-modal-title">Fine Details</h3>

          <button
            type="button"
            className="fine-modal-close"
            onClick={onClose}
            aria-label="Close fine details"
          >
            ×
          </button>
        </div>

        <div className="fine-modal-body">
          <div className="fine-detail-row">
            <span>Fine Number</span>
            <strong>{fine.fine_number || "—"}</strong>
          </div>

          <div className="fine-detail-row">
            <span>Member</span>
            <strong>{fine.member_name || "—"}</strong>
          </div>

          <div className="fine-detail-row">
            <span>Rule</span>
            <strong>{fine.rule_title || "—"}</strong>
          </div>

          <div className="fine-detail-row">
            <span>Rule Version</span>
            <strong>{fine.rule_version ?? "—"}</strong>
          </div>

          <div className="fine-detail-row">
            <span>Assessed Amount</span>
            <strong>
              {formatAmount(fine.assessed_amount, fine.currency)}
            </strong>
          </div>

          <div className="fine-detail-row">
            <span>Amount Paid</span>
            <strong>
              {formatAmount(fine.amount_paid, fine.currency)}
            </strong>
          </div>

          <div className="fine-detail-row">
            <span>Outstanding Amount</span>
            <strong>
              {formatAmount(fine.outstanding_amount, fine.currency)}
            </strong>
          </div>

          <div className="fine-detail-row">
            <span>Status</span>
            <FineStatusBadge status={fine.status} />
          </div>

          <div className="fine-detail-row">
            <span>Date Issued</span>
            <strong>{formatDate(fine.issued_at)}</strong>
          </div>

          <div className="fine-detail-row">
            <span>Due Date</span>
            <strong>{formatDate(fine.due_date)}</strong>
          </div>

          {fine.rule_description && (
            <div className="fine-detail-description">
              <h4>Rule Description</h4>
              <p>{fine.rule_description}</p>
            </div>
          )}

          {fine.rule_conditions && (
            <div className="fine-detail-description">
              <h4>Rule Conditions</h4>
              <p>{fine.rule_conditions}</p>
            </div>
          )}
        </div>

        <div className="fine-modal-footer">
          <button
            type="button"
            className="fine-button fine-button-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export default FineDetailsModal;
