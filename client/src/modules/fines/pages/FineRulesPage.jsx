

import { useCallback, useEffect, useState } from "react";
import FineRuleForm from "../components/FineRuleForm";
import FineRulesTable from "../components/FineRulesTable";
import FineFeedback from "../components/FineFeedback";
import {
  getFineRules,
  createFineRule,
  createFineRuleVersion,
  updateFineRuleStatus,
} from "../services/fineApi";

function FineRulesPage({ user, role: suppliedRole }) {
  const role = (suppliedRole || user?.role || "").toLowerCase();
  const isChairperson = role === "chairperson";

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formMode, setFormMode] = useState("");
  const [selectedRule, setSelectedRule] = useState(null);

  const loadRules = useCallback(async () => {
    try {
      const response = await getFineRules();
      setRules(response.data || []);
    } catch (err) {
      setError(err.message || "Unable to load fine rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    getFineRules()
      .then((response) => {
        if (active) setRules(response.data || []);
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load fine rules.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(formData) {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (formMode === "version" && selectedRule) {
        await createFineRuleVersion(selectedRule.id, formData);
        setSuccess("New fine rule version created successfully.");
      } else {
        await createFineRule(formData);
        setSuccess("Fine rule created successfully.");
      }

      setFormMode("");
      setSelectedRule(null);
      setLoading(true);
      await loadRules();
    } catch (err) {
      setError(err.message || "Unable to save fine rule.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleRetire(rule) {
    const confirmed = window.confirm(
      `Retire rule ${rule.rule_code}, version ${rule.version}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await updateFineRuleStatus(rule.id, "retired");
      setSuccess("Fine rule retired successfully.");
      setLoading(true);
      await loadRules();
    } catch (err) {
      setError(err.message || "Unable to retire fine rule.");
    }
  }

  async function handleActivate(rule) {
    setError("");
    setSuccess("");

    try {
      await updateFineRuleStatus(rule.id, "active");
      setSuccess(`Rule ${rule.rule_code} is now active.`);
      setLoading(true);
      await loadRules();
    } catch (err) {
      setError(err.message || "Unable to activate fine rule.");
    }
  }

  function handleCreateVersion(rule) {
    setSelectedRule(rule);
    setFormMode("version");
    setError("");
    setSuccess("");
  }

  function handleView(rule) {
    setSelectedRule(rule);
    setFormMode("view");
  }

  function closeForm() {
    setFormMode("");
    setSelectedRule(null);
  }

  const initialValues =
    formMode === "version" && selectedRule
      ? {
          ruleCode: selectedRule.rule_code,
          title: selectedRule.title,
          description: selectedRule.description || "",
          conditions: selectedRule.conditions || "",
          fineAmount: selectedRule.fine_amount,
          effectiveFrom: selectedRule.effective_from
            ? new Date(selectedRule.effective_from)
                .toISOString()
                .slice(0, 10)
            : "",
          effectiveTo: "",
        }
      : {};

  return (
    <section className="fines-page">
      <div className="fines-page-header">
        <div>
          <h2>Fine Rules</h2>
          <p>Manage and review the rules governing member fines.</p>
        </div>

        {isChairperson && !formMode && (
          <button
            type="button"
            className="fine-button fine-button-primary"
            onClick={() => setFormMode("create")}
          >
            Create Fine Rule
          </button>
        )}
      </div>

      <FineFeedback message={error} type="error" />
      <FineFeedback message={success} type="success" />

      {formMode === "create" || formMode === "version" ? (
        <FineRuleForm
          key={`${formMode}-${selectedRule?.id || "new"}`}
          initialValues={initialValues}
          versionMode={formMode === "version"}
          loading={saving}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      ) : formMode === "view" && selectedRule ? (
        <div className="fine-detail-panel">
          <div className="fine-detail-panel-header">
            <h3>{selectedRule.title}</h3>
            <button
              type="button"
              className="fine-button fine-button-secondary"
              onClick={closeForm}
            >
              Close
            </button>
          </div>

          <p><strong>Rule code:</strong> {selectedRule.rule_code}</p>
          <p><strong>Version:</strong> {selectedRule.version}</p>
          <p><strong>Amount:</strong> {selectedRule.currency || "KES"} {selectedRule.fine_amount}</p>
          <p><strong>Description:</strong> {selectedRule.description || "—"}</p>
          <p><strong>Conditions:</strong> {selectedRule.conditions || "—"}</p>
          <p><strong>Effective from:</strong> {selectedRule.effective_from ? new Date(selectedRule.effective_from).toLocaleDateString() : "—"}</p>
          <p><strong>Effective to:</strong> {selectedRule.effective_to ? new Date(selectedRule.effective_to).toLocaleDateString() : "—"}</p>
          <p><strong>Status:</strong> {selectedRule.status}</p>
        </div>
      ) : (
        <>
          <div className="fine-section-heading">
            <h3>Available Fine Rules</h3>
            <button
              type="button"
              className="fine-button fine-button-secondary"
              onClick={() => {
                setLoading(true);
                setError("");
                void loadRules();
              }}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          <FineRulesTable
            rules={rules}
            loading={loading}
            role={role}
            onView={handleView}
            onActivate={handleActivate}
            onCreateVersion={handleCreateVersion}
            onUpdateStatus={handleRetire}
          />
        </>
      )}
    </section>
  );
}

export default FineRulesPage;
