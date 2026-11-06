
import { useCallback, useEffect, useState } from "react";

import {
  getFineWithdrawals,
  getFinePayments,
  initiateFineWithdrawal,
  decideFineWithdrawal,
  executeFineWithdrawal,
} from "../services/fineApi";

import FineWithdrawalForm from "../components/FineWithrawalForm.jsx";
import FineWithdrawalExecutionForm from "../components/FineWithdrawalExecutionForm";
import FineWithdrawalsTable from "../components/FineWithdrawalsTable";
import FineFeedback from "../components/FineFeedback";

export default function FineWithdrawalsPage({ user }) {
  const role = String(user?.role || "").toLowerCase();
  const isTreasurer = role === "treasurer";
  const isChairperson = role === "chairperson";

  const [withdrawals, setWithdrawals] = useState([]);
  const [payments, setPayments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showInitiationForm, setShowInitiationForm] = useState(false);
  const [executionWithdrawal, setExecutionWithdrawal] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const withdrawalResponse = await getFineWithdrawals();
      setWithdrawals(withdrawalResponse.data || []);

      if (isTreasurer) {
        const paymentResponse = await getFinePayments();
        setPayments(paymentResponse.data || []);
      } else {
        setPayments([]);
      }
    } catch (err) {
      setError(err.message || "Unable to load fine withdrawals.");
    } finally {
      setLoading(false);
    }
  }, [isTreasurer]);

  useEffect(() => {
    let active = true;

    getFineWithdrawals()
      .then(async (withdrawalResponse) => {
        if (!active) return;
        setWithdrawals(withdrawalResponse.data || []);

        if (isTreasurer) {
          const paymentResponse = await getFinePayments();
          if (active) setPayments(paymentResponse.data || []);
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load fine withdrawals.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isTreasurer]);

  const availablePayments = payments.filter(
    (payment) => Number(payment.available_amount) > 0
  );

  async function handleInitiate(formData) {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await initiateFineWithdrawal(formData);
      setShowInitiationForm(false);
      setSuccess("Withdrawal submitted for chairperson approval.");
      setLoading(true);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to initiate withdrawal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecision(withdrawal, decision) {
    let rejectionReason;

    if (decision === "reject") {
      rejectionReason = window.prompt("Enter the reason for rejecting this withdrawal:");

      if (!rejectionReason?.trim()) return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to ${decision} withdrawal ${withdrawal.withdrawal_number}?`
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await decideFineWithdrawal(withdrawal.id, {
        decision,
        rejectionReason,
      });

      setSuccess(
        decision === "approve"
          ? "Withdrawal approved."
          : "Withdrawal rejected."
      );

      setLoading(true);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to process withdrawal decision.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExecute(executionData) {
    if (!executionWithdrawal) return;

    const confirmed = window.confirm(
      `Confirm execution of withdrawal ${executionWithdrawal.withdrawal_number} for KES ${executionWithdrawal.amount}?`
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await executeFineWithdrawal(
        executionWithdrawal.id,
        executionData
      );

      setExecutionWithdrawal(null);
      setSuccess("Withdrawal executed successfully.");
      setLoading(true);
      await loadData();
    } catch (err) {
      setError(err.message || "Unable to execute withdrawal.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleView(withdrawal) {
    const details = [
      `Withdrawal: ${withdrawal.withdrawal_number}`,
      `Amount: ${withdrawal.currency} ${withdrawal.amount}`,
      `Purpose: ${withdrawal.purpose}`,
      `Status: ${withdrawal.status}`,
      `Initiated by: ${withdrawal.initiated_by_name || "N/A"}`,
      `Initiated at: ${withdrawal.initiated_at || "N/A"}`,
      `Approved by: ${withdrawal.approved_by_name || "N/A"}`,
      `Completed at: ${withdrawal.completed_at || "N/A"}`,
      `Payment reference: ${withdrawal.payment_reference || "N/A"}`,
    ];

    window.alert(details.join("\n"));
  }

  if (!isTreasurer && !isChairperson) {
    return (
      <div className="fine-page">
        <div className="fine-alert fine-alert-error">
          You do not have permission to access fine withdrawals.
        </div>
      </div>
    );
  }

  return (
    <div className="fine-page">
      <div className="fine-page-header">
        <div>
          <h2>Fine Fund Withdrawals</h2>
          <p>
            {isTreasurer
              ? "Submit withdrawal requests and execute approved withdrawals."
              : "Review and approve or reject withdrawal requests."}
          </p>
        </div>

        {isTreasurer && (
          <button
            className="fine-button fine-button-primary"
            onClick={() => setShowInitiationForm((value) => !value)}
            disabled={submitting}
          >
            {showInitiationForm ? "Close form" : "Initiate withdrawal"}
          </button>
        )}
      </div>

      <FineFeedback message={error} type="error" />
      <FineFeedback message={success} type="success" />

      {showInitiationForm && isTreasurer && (
        <FineWithdrawalForm
          onSubmit={handleInitiate}
          onCancel={() => setShowInitiationForm(false)}
          loading={submitting}
        />
      )}

      {executionWithdrawal && isTreasurer && (
        <FineWithdrawalExecutionForm
          withdrawal={executionWithdrawal}
          availablePayments={availablePayments}
          onSubmit={handleExecute}
          onCancel={() => setExecutionWithdrawal(null)}
          loading={submitting}
        />
      )}

      <FineWithdrawalsTable
        withdrawals={withdrawals}
        loading={loading}
        role={role}
        onView={handleView}
        onApprove={(withdrawal) => handleDecision(withdrawal, "approve")}
        onReject={(withdrawal) => handleDecision(withdrawal, "reject")}
        onExecute={(withdrawal) => setExecutionWithdrawal(withdrawal)}
      />
    </div>
  );
}