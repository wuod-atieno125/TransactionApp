

import FineStatusBadge from "./FineStatusBadge";

function FineRulesTable({
  rules = [],
  loading = false,
  role,
  onView,
  onCreateVersion,
  onActivate,
  onUpdateStatus,
}) {
  const canManage = role?.toLowerCase() === "chairperson";

  if (loading) {
    return <p className="fine-loading">Loading fine rules...</p>;
  }

  return (
    <div className="fine-table-container">
      <table className="fine-table">
        <thead>
          <tr>
            <th>Rule Code</th>
            <th>Title</th>
            <th>Version</th>
            <th>Fine Amount</th>
            <th>Effective From</th>
            <th>Effective To</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rules.length === 0 ? (
            <tr>
              <td colSpan="8" className="fine-empty">
                No fine rules found.
              </td>
            </tr>
          ) : (
            rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.rule_code}</td>
                <td>{rule.title}</td>
                <td>v{rule.version}</td>
                <td>
                  {rule.currency || "KES"}{" "}
                  {Number(rule.fine_amount).toLocaleString("en-KE", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td>
                  {rule.effective_from
                    ? new Date(rule.effective_from).toLocaleDateString()
                    : "—"}
                </td>
                <td>
                  {rule.effective_to
                    ? new Date(rule.effective_to).toLocaleDateString()
                    : "—"}
                </td>
                <td>
                  <FineStatusBadge status={rule.status} />
                </td>
                <td>
                  <div className="fine-action-group">
                    {onView && (
                      <button
                        type="button"
                        className="fine-button fine-button-secondary"
                        onClick={() => onView(rule)}
                      >
                        View
                      </button>
                    )}

                    {canManage && rule.status !== "retired" && (
                      <>
                        {rule.status === "draft" && onActivate && (
                          <button
                            type="button"
                            className="fine-button fine-button-primary"
                            onClick={() => onActivate(rule)}
                          >
                            Activate
                          </button>
                        )}

                        {onCreateVersion && (
                          <button
                            type="button"
                            className="fine-button fine-button-primary"
                            onClick={() => onCreateVersion(rule)}
                          >
                            New Version
                          </button>
                        )}

                        {onUpdateStatus && (
                          <button
                            type="button"
                            className="fine-button fine-button-danger"
                            onClick={() => onUpdateStatus(rule)}
                          >
                            Retire
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default FineRulesTable;
