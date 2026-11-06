
import { useMemo, useState } from "react";
import FineFeedback from "./FineFeedback";

function toCents(value) {
  const amount = String(value ?? "0");
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) return 0;

  const [whole, fraction = ""] = amount.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function money(cents) {
  return (cents / 100).toFixed(2);
}

export default function FineWithdrawalExecutionForm({
  withdrawal,
  availablePayments = [],
  onSubmit,
  onCancel,
  loading = false,
}) {
  const [allocations, setAllocations] = useState({});
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const targetCents = toCents(withdrawal?.amount);

  const allocatedCents = useMemo(
    () =>
      Object.values(allocations).reduce(
        (total, amount) => total + toCents(amount || "0"),
        0
      ),
    [allocations]
  );

  function updateAllocation(paymentId, value) {
    setAllocations((current) => ({
      ...current,
      [paymentId]: value,
    }));
  }

  function submit(event) {
    event.preventDefault();
    setError("");

    const selected = Object.entries(allocations)
      .filter(([, amount]) => amount !== "")
      .map(([finePaymentId, allocatedAmount]) => ({
        finePaymentId,
        allocatedAmount,
      }));

    if (!selected.length) {
      setError("Select at least one payment to allocate.");
      return;
    }

    if (allocatedCents !== targetCents) {
      setError(
        `Allocations must total KES ${money(targetCents)}. Current total: KES ${money(allocatedCents)}.`
      );
      return;
    }

    for (const allocation of selected) {
      const payment = availablePayments.find(
        (item) => item.id === allocation.finePaymentId
      );

      if (
        !payment ||
        toCents(allocation.allocatedAmount) > toCents(payment.available_amount)
      ) {
        setError("An allocation exceeds the available amount for a selected payment.");
        return;
      }
    }

    onSubmit({
      allocations: selected,
      paymentReference: paymentReference.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <form className="fine-form fine-withdrawal-form" onSubmit={submit}>
      <h3>Execute withdrawal</h3>

      <p>
        Withdrawal amount: <strong>KES {money(targetCents)}</strong>
      </p>

      <FineFeedback message={error} type="error" />

      {availablePayments.length === 0 ? (
        <p>No unallocated fine payments are currently available.</p>
      ) : (
        <div className="fine-allocation-list">
          {availablePayments.map((payment) => (
            <div className="fine-allocation-row" key={payment.id}>
              <div>
                <strong>{payment.payment_number}</strong>
                <div>{payment.fine_number}</div>
                <small>{payment.member_name}</small>
                <div>
                  Available: KES {Number(payment.available_amount).toFixed(2)}
                </div>
              </div>

              <div>
                <label htmlFor={`allocation-${payment.id}`}>
                  Allocation (KES)
                </label>
                <input
                  id={`allocation-${payment.id}`}
                  type="number"
                  min="0"
                  max={payment.available_amount}
                  step="0.01"
                  value={allocations[payment.id] || ""}
                  onChange={(event) =>
                    updateAllocation(payment.id, event.target.value)
                  }
                  disabled={loading}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fine-allocation-total">
        Allocated: <strong>KES {money(allocatedCents)}</strong>
        {" / "}KES {money(targetCents)}
      </div>

      <div className="fine-form-grid fine-withdrawal-fields">
        <div className="fine-form-group fine-withdrawal-field-wide">
          <label htmlFor="withdrawal-payment-reference">
            Disbursement reference (optional)
          </label>
          <input
            id="withdrawal-payment-reference"
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.target.value)}
            maxLength={150}
            disabled={loading}
          />
        </div>

        <div className="fine-form-group fine-withdrawal-field-wide">
          <label htmlFor="withdrawal-execution-notes">
            Execution notes (optional)
          </label>
          <textarea
            id="withdrawal-execution-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            rows={3}
            disabled={loading}
          />
        </div>
      </div>

      <div className="fine-form-actions">
        <button
          type="submit"
          className="fine-button fine-button-primary"
          disabled={loading || !availablePayments.length}
        >
          {loading ? "Executing..." : "Confirm execution"}
        </button>

        <button
          type="button"
          className="fine-button fine-button-secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}