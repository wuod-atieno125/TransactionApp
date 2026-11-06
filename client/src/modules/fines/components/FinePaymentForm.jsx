

import { useState } from "react";
import FineFeedback from "./FineFeedback";

const initialForm = {
  amount: "",
  paymentMethod: "mpesa",
  paymentReference: "",
  paymentDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

function FinePaymentForm({
  fine,
  onSubmit,
  onCancel,
  loading = false,
}) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  const outstanding = Number(fine?.outstanding_amount || 0);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const amount = Number(form.amount);

    if (!fine?.id) {
      setError("Please select a valid fine.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Payment amount must be greater than zero.");
      return;
    }

    if (amount > outstanding) {
      setError("Payment cannot exceed the outstanding balance.");
      return;
    }

    try {
      await onSubmit?.({
        amount: form.amount,
        paymentMethod: form.paymentMethod,
        paymentReference: form.paymentReference.trim() || null,
        paymentDate: form.paymentDate,
        notes: form.notes.trim() || null,
      });
    } catch (err) {
      setError(err.message || "Unable to record payment.");
    }
  }

  return (
    <form className="fine-form" onSubmit={handleSubmit}>
      <h3>Record Fine Payment</h3>

      {fine && (
        <div className="fine-selected-record">
          <p><strong>Fine:</strong> {fine.fine_number}</p>
          <p><strong>Member:</strong> {fine.member_name || "Member"}</p>
          <p>
            <strong>Outstanding:</strong>{" "}
            {fine.currency || "KES"}{" "}
            {outstanding.toLocaleString("en-KE", {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>
      )}

      <FineFeedback message={error} type="error" />

      <div className="fine-form-group">
        <label htmlFor="amount">Payment Amount</label>
        <input
          id="amount"
          name="amount"
          type="number"
          min="0.01"
          max={outstanding}
          step="0.01"
          value={form.amount}
          onChange={handleChange}
          required
        />
      </div>

      <div className="fine-form-group">
        <label htmlFor="paymentMethod">Payment Method</label>
        <select
          id="paymentMethod"
          name="paymentMethod"
          value={form.paymentMethod}
          onChange={handleChange}
          required
        >
          <option value="mpesa">M-Pesa</option>
          <option value="cash">Cash</option>
          <option value="bank">Bank Transfer</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="fine-form-group">
        <label htmlFor="paymentReference">Payment Reference</label>
        <input
          id="paymentReference"
          name="paymentReference"
          value={form.paymentReference}
          onChange={handleChange}
          placeholder="e.g. M-Pesa transaction code"
        />
      </div>

      <div className="fine-form-group">
        <label htmlFor="paymentDate">Payment Date</label>
        <input
          id="paymentDate"
          name="paymentDate"
          type="date"
          value={form.paymentDate}
          onChange={handleChange}
          required
        />
      </div>

      <div className="fine-form-group">
        <label htmlFor="notes">Notes (Optional)</label>
        <textarea
          id="notes"
          name="notes"
          rows="3"
          value={form.notes}
          onChange={handleChange}
        />
      </div>

      <div className="fine-form-actions">
        <button
          type="submit"
          className="fine-button fine-button-primary"
          disabled={loading || outstanding <= 0}
        >
          {loading ? "Recording..." : "Record Payment"}
        </button>

        {onCancel && (
          <button
            type="button"
            className="fine-button fine-button-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export default FinePaymentForm;
