
import { useCallback, useEffect, useState } from "react";
import FineRecordsTable from "../components/FileRecordsTable.jsx";
import FineDetailsModal from "../components/FineDetailsModal";
import FineFeedback from "../components/FineFeedback";
import {
  getFineRecords,
  getFineRules,
  getActiveFineMembers,
  issueFine,
} from "../services/fineApi";

function FineRecordsPage({ user, role: suppliedRole }) {
  const role = (suppliedRole || user?.role || "").toLowerCase();
  const isTreasurer = role === "treasurer";

  const [records, setRecords] = useState([]);
  const [activeRules, setActiveRules] = useState([]);
  const [activeRulesLoading, setActiveRulesLoading] = useState(true);
  const [activeMembers, setActiveMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedFine, setSelectedFine] = useState(null);
  const [showIssueForm, setShowIssueForm] = useState(false);

  const [form, setForm] = useState({
    fineRuleId: "",
    memberId: "",
    dueDate: "",
    initialPaymentAmount: "0",
    initialPaymentMethod: "mpesa",
    initialPaymentReference: "",
  });

  const loadRecords = useCallback(async () => {
    try {
      const response = await getFineRecords();
      setRecords(response.data || []);
    } catch (err) {
      setError(err.message || "Unable to load fine records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getFineRecords()
      .then((response) => {
        if (active) setRecords(response.data || []);
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load fine records.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

      if (isTreasurer) {
        getFineRules({ status: "active" })
        .then((response) => {
          if (active) setActiveRules(response.data || []);
        })
        .catch((err) => {
          if (active) {
            setError(err.message || "Unable to load active fine rules.");
          }
        })
        .finally(() => {
          if (active) setActiveRulesLoading(false);
        });

      getActiveFineMembers()
        .then((response) => {
          if (active) setActiveMembers(response.data || []);
        })
        .catch((err) => {
          if (active) {
            setError(err.message || "Unable to load active members.");
          }
        });
    }

    return () => {
      active = false;
    };
  }, [isTreasurer]);

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleIssueFine(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.fineRuleId || !form.memberId) {
      setError("Select an active fine rule and member.");
      return;
    }

    const selectedRule = activeRules.find(
      (rule) => rule.id === form.fineRuleId
    );
    const initialPaymentAmountValue =
      form.initialPaymentAmount.trim() || "0";
    const initialPaymentAmount = Number(initialPaymentAmountValue);

    if (
      !selectedRule ||
      !Number.isFinite(initialPaymentAmount) ||
      initialPaymentAmount < 0 ||
      initialPaymentAmount > Number(selectedRule.fine_amount)
    ) {
      setError("Enter an initial payment between zero and the fine amount.");
      return;
    }

    setSaving(true);

    try {
      await issueFine({
        fineRuleId: form.fineRuleId,
        memberId: form.memberId,
        dueDate: form.dueDate || null,
        initialPaymentAmount: initialPaymentAmountValue,
        initialPaymentMethod: form.initialPaymentMethod,
        initialPaymentReference: form.initialPaymentReference.trim() || null,
      });

      setSuccess(
        initialPaymentAmount > 0
          ? "Fine and initial payment recorded successfully."
          : "Fine recorded successfully."
      );
      setForm({
        fineRuleId: "",
        memberId: "",
        dueDate: "",
        initialPaymentAmount: "0",
        initialPaymentMethod: "mpesa",
        initialPaymentReference: "",
      });
      setShowIssueForm(false);
      await loadRecords();
    } catch (err) {
      setError(err.message || "Unable to issue fine.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="fines-page">
      <div className="fines-page-header">
        <div>
          <h2>Fine Records</h2>
          <p>View issued fines, payments received and outstanding balances.</p>
        </div>

        {isTreasurer && (
          <button
            type="button"
            className="fine-button fine-button-primary"
            onClick={() => setShowIssueForm((current) => !current)}
          >
            {showIssueForm ? "Close Form" : "Issue Fine"}
          </button>
        )}
      </div>

      <FineFeedback message={error} type="error" />
      <FineFeedback message={success} type="success" />

      {showIssueForm && isTreasurer && (
        <form className="fine-form" onSubmit={handleIssueFine}>
          <h3>Record a Fine</h3>

          <div className="fine-form-grid">
            <div className="fine-form-group">
              <label htmlFor="fineRuleId">Active Fine Rule</label>
              <select
                id="fineRuleId"
                name="fineRuleId"
                value={form.fineRuleId}
                onChange={handleFormChange}
                required
              >
                <option value="">
                  {activeRulesLoading
                    ? "Loading active fine rules..."
                    : activeRules.length
                      ? "Select a fine rule"
                      : "No active fine rules available"}
                </option>
                {activeRules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.rule_code} — {rule.title} (KES {rule.fine_amount})
                  </option>
                ))}
              </select>
            </div>

            <div className="fine-form-group">
              <label htmlFor="memberId">Active Member</label>
              <select
                id="memberId"
                name="memberId"
                value={form.memberId}
                onChange={handleFormChange}
                required
              >
                <option value="">Select a member</option>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="fine-form-group">
              <label htmlFor="dueDate">Due Date (Optional)</label>
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleFormChange}
              />
            </div>

            <div className="fine-form-group">
              <label htmlFor="initialPaymentAmount">
                Amount Paid Now (Optional)
              </label>
              <input
                id="initialPaymentAmount"
                name="initialPaymentAmount"
                type="number"
                min="0"
                max={
                  activeRules.find((rule) => rule.id === form.fineRuleId)
                    ?.fine_amount || undefined
                }
                step="0.01"
                value={form.initialPaymentAmount}
                onChange={handleFormChange}
                disabled={saving}
              />
            </div>

            <div className="fine-form-group">
              <label htmlFor="initialPaymentMethod">Payment Method</label>
              <select
                id="initialPaymentMethod"
                name="initialPaymentMethod"
                value={form.initialPaymentMethod}
                onChange={handleFormChange}
                disabled={
                  saving || Number(form.initialPaymentAmount) === 0
                }
              >
                <option value="mpesa">M-Pesa</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="fine-form-group">
              <label htmlFor="initialPaymentReference">
                Payment Reference (Optional)
              </label>
              <input
                id="initialPaymentReference"
                name="initialPaymentReference"
                value={form.initialPaymentReference}
                onChange={handleFormChange}
                maxLength={150}
                disabled={
                  saving || Number(form.initialPaymentAmount) === 0
                }
              />
            </div>
          </div>

          <div className="fine-form-actions">
            <button
              type="submit"
              className="fine-button fine-button-primary"
              disabled={saving}
            >
              {saving ? "Recording..." : "Record Fine"}
            </button>
            <button
              type="button"
              className="fine-button fine-button-secondary"
              onClick={() => setShowIssueForm(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="fine-section-heading">
        <h3>Fine History</h3>
        <button
          type="button"
          className="fine-button fine-button-secondary"
          onClick={() => {
            setLoading(true);
            setError("");
            void loadRecords();
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <FineRecordsTable
        records={records}
        loading={loading}
        role={role}
        onView={setSelectedFine}
      />

      <FineDetailsModal
        fine={selectedFine}
        onClose={() => setSelectedFine(null)}
      />
    </section>
  );
}

export default FineRecordsPage;
