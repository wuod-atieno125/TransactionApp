

import { useState } from "react";
import FineFeedback from "./FineFeedback";

const initialForm = {
  ruleCode: "",
  title: "",
  description: "",
  conditions: "",
  fineAmount: "",
  effectiveFrom: "",
  effectiveTo: "",
};

function FineRuleForm({
  initialValues = {},
  onSubmit,
  onCancel,
  loading = false,
  versionMode = false,
}) {
  const initialFormState = {
    ...initialForm,
    ...Object.fromEntries(
      Object.entries(initialValues).map(([field, value]) => [
        field,
        value == null ? "" : String(value),
      ])
    ),
  };
  const [form, setForm] = useState(initialFormState);

  const [error, setError] = useState("");
  const hasChanges = Object.keys(initialForm).some(
    (field) =>
      form[field].trim() !== initialFormState[field].trim()
  );

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

    if (
      !form.ruleCode.trim() ||
      !form.title.trim() ||
      !form.description.trim() ||
      !form.conditions.trim() ||
      !form.fineAmount ||
      !form.effectiveFrom
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (!Number.isFinite(Number(form.fineAmount)) ||
        Number(form.fineAmount) <= 0) {
      setError("Fine amount must be greater than zero.");
      return;
    }

    if (
      form.effectiveTo &&
      new Date(form.effectiveTo) < new Date(form.effectiveFrom)
    ) {
      setError("Effective end date cannot be before the start date.");
      return;
    }

    try {
      await onSubmit?.({
        ...form,
        ruleCode: form.ruleCode.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        conditions: form.conditions.trim(),
        fineAmount: form.fineAmount,
        effectiveTo: form.effectiveTo || null,
      });
    } catch (err) {
      setError(err.message || "Unable to save fine rule.");
    }
  }

  return (
    <form className="fine-form" onSubmit={handleSubmit}>
      <h3>{versionMode ? "Create New Rule Version" : "Create Fine Rule"}</h3>

      <FineFeedback message={error} type="error" />

      <div className="fine-form-grid">
        <div className="fine-form-group">
          <label htmlFor="ruleCode">Rule Code</label>
          <input
            id="ruleCode"
            name="ruleCode"
            value={form.ruleCode}
            onChange={handleChange}
            disabled={versionMode}
            required
          />
        </div>

        <div className="fine-form-group">
          <label htmlFor="title">Rule Title</label>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="fine-form-group">
          <label htmlFor="fineAmount">Fine Amount (KES)</label>
          <input
            id="fineAmount"
            name="fineAmount"
            type="number"
            min="0.01"
            step="0.01"
            value={form.fineAmount}
            onChange={handleChange}
            required
          />
        </div>

        <div className="fine-form-group">
          <label htmlFor="effectiveFrom">Effective From</label>
          <input
            id="effectiveFrom"
            name="effectiveFrom"
            type="date"
            value={form.effectiveFrom}
            onChange={handleChange}
            required
          />
        </div>

        <div className="fine-form-group">
          <label htmlFor="effectiveTo">Effective To (Optional)</label>
          <input
            id="effectiveTo"
            name="effectiveTo"
            type="date"
            value={form.effectiveTo || ""}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="fine-form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          rows="3"
          value={form.description}
          onChange={handleChange}
          required
        />
      </div>

      <div className="fine-form-group">
        <label htmlFor="conditions">Conditions</label>
        <textarea
          id="conditions"
          name="conditions"
          rows="3"
          value={form.conditions}
          onChange={handleChange}
          required
        />
      </div>

      <div className="fine-form-actions">
        <button
          type="submit"
          className="fine-button fine-button-primary"
          disabled={loading || !hasChanges}
        >
          {loading ? "Saving..." : versionMode ? "Create Version" : "Save Rule"}
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

export default FineRuleForm;
