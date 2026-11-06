
import { useCallback, useEffect, useState } from "react";
import FinePaymentForm from "../components/FinePaymentForm";
import FinePaymentsTable from "../components/FinePaymentsTable";
import FineFeedback from "../components/FineFeedback";
import {
  getFinePayments,
  getFineRecords,
  recordFinePayment,
} from "../services/fineApi";

function FinePaymentsPage({ user, role: suppliedRole }) {
  const role = (suppliedRole || user?.role || "").toLowerCase();
  const isTreasurer = role === "treasurer";

  const [payments, setPayments] = useState([]);
  const [fineRecords, setFineRecords] = useState([]);
  const [fineRecordsLoading, setFineRecordsLoading] = useState(true);
  const [selectedFine, setSelectedFine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPayments = useCallback(async () => {
    try {
      const response = await getFinePayments();
      setPayments(response.data || []);
    } catch (err) {
      setError(err.message || "Unable to load fine payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFines = useCallback(async () => {
    if (!isTreasurer) return;

    setFineRecordsLoading(true);
    try {
      const response = await getFineRecords();
      setFineRecords(
        (response.data || []).filter(
          (fine) => Number(fine.outstanding_amount) > 0
        )
      );
    } catch (err) {
      setError(err.message || "Unable to load outstanding fines.");
    } finally {
      setFineRecordsLoading(false);
    }
  }, [isTreasurer]);

  useEffect(() => {
    let active = true;

    getFinePayments()
      .then((response) => {
        if (active) setPayments(response.data || []);
      })
      .catch((err) => {
        if (active) setError(err.message || "Unable to load fine payments.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

      if (isTreasurer) {
        getFineRecords()
        .then((response) => {
          if (active) {
            setFineRecords(
              (response.data || []).filter(
                (fine) => Number(fine.outstanding_amount) > 0
              )
            );
          }
        })
        .catch((err) => {
          if (active) {
            setError(err.message || "Unable to load outstanding fines.");
          }
        })
        .finally(() => {
          if (active) setFineRecordsLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [isTreasurer]);

  async function handleRecordPayment(paymentData) {
    if (!selectedFine) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await recordFinePayment(selectedFine.id, paymentData);
      setSuccess("Fine payment recorded successfully.");
      setSelectedFine(null);
      setLoading(true);
      await Promise.all([loadPayments(), loadFines()]);
    } catch (err) {
      setError(err.message || "Unable to record fine payment.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="fines-page">
      <div className="fines-page-header">
        <div>
          <h2>Fine Payments</h2>
          <p>Review payments received against issued fines.</p>
        </div>
      </div>

      <FineFeedback message={error} type="error" />
      <FineFeedback message={success} type="success" />

      {isTreasurer && (
        <div className="fine-payment-entry">
          {selectedFine ? (
            <FinePaymentForm
              fine={selectedFine}
              loading={saving}
              onSubmit={handleRecordPayment}
              onCancel={() => setSelectedFine(null)}
            />
          ) : (
            <div className="fine-form">
              <h3>Record a Fine Payment</h3>
              <p>Select an outstanding fine to record a payment.</p>

              <div className="fine-form-group">
                <label htmlFor="paymentFine">Outstanding Fine</label>
                <select
                  id="paymentFine"
                  value=""
                  onChange={(event) => {
                    const fine = fineRecords.find(
                      (item) => item.id === event.target.value
                    );
                    if (fine) setSelectedFine(fine);
                  }}
                >
                  <option value="">
                    {fineRecordsLoading
                      ? "Loading outstanding fines..."
                      : fineRecords.length
                        ? "Select an outstanding fine"
                        : "No outstanding fines available"}
                  </option>
                  {fineRecords.map((fine) => (
                    <option key={fine.id} value={fine.id}>
                      {fine.fine_number} — {fine.rule_title} —{" "}
                      {fine.member_name || "Member"} —
                      Outstanding: {fine.currency || "KES"}{" "}
                      {Number(fine.outstanding_amount).toLocaleString("en-KE")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="fine-section-heading">
        <h3>Payment History</h3>
        <button
          type="button"
          className="fine-button fine-button-secondary"
          onClick={() => {
            setLoading(true);
            setError("");
            void loadPayments();
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <FinePaymentsTable payments={payments} loading={loading} />
    </section>
  );
}

export default FinePaymentsPage;
