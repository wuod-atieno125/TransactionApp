
import { useState } from "react";
import FineFeedback from "./FineFeedback";

export default function FineWithdrawalForm({
  onSubmit,
  onCancel,
  loading = false,
}) {
  const [form, setForm] = useState({
    amount: "",
    purpose: "",
    notes: "",
  });

  const [error, setError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!/^\d{1,12}(\.\d{1,2})?$/.test(form.amount) || Number(form.amount) <= 0) {
      setError("Enter a valid withdrawal amount.");
      return;
    }

    if (!form.purpose.trim()) {
      setError("Enter the purpose of this withdrawal.");
      return;
    }

    onSubmit({
      amount: form.amount,
      purpose: form.purpose.trim(),
      notes: form.notes.trim(),
    });
  }

  return (
    <form className="fine-form fine-withdrawal-form" onSubmit={handleSubmit}>
      <h3>Initiate fine fund withdrawal</h3>

      <FineFeedback message={error} type="error" />

      <div className="fine-form-grid fine-withdrawal-fields">
        <div className="fine-form-group">
          <label htmlFor="withdrawal-amount">Amount (KES)</label>
          <input
            id="withdrawal-amount"
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={updateField}
            required
            disabled={loading}
          />
        </div>

        <div className="fine-form-group fine-withdrawal-field-wide">
          <label htmlFor="withdrawal-purpose">Purpose</label>
          <textarea
            id="withdrawal-purpose"
            name="purpose"
            value={form.purpose}
            onChange={updateField}
            maxLength={500}
            rows={3}
            required
            disabled={loading}
          />
        </div>

        <div className="fine-form-group fine-withdrawal-field-wide">
          <label htmlFor="withdrawal-notes">Additional notes (optional)</label>
          <textarea
            id="withdrawal-notes"
            name="notes"
            value={form.notes}
            onChange={updateField}
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
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit for approval"}
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