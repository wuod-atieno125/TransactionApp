

const statusLabels = {
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  active: "Active",
  draft: "Draft",
  retired: "Retired",
};

const statusClasses = {
  unpaid: "fine-status-unpaid",
  partially_paid: "fine-status-partial",
  paid: "fine-status-paid",
  pending: "fine-status-pending",
  approved: "fine-status-approved",
  rejected: "fine-status-rejected",
  completed: "fine-status-completed",
  active: "fine-status-active",
  draft: "fine-status-draft",
  retired: "fine-status-retired",
};

function FineStatusBadge({ status }) {
  const normalizedStatus = String(status || "unknown")
    .trim()
    .toLowerCase();

  const label =
    statusLabels[normalizedStatus] ||
    normalizedStatus.replace(/_/g, " ");

  const className =
    statusClasses[normalizedStatus] || "fine-status-default";

  return (
    <span className={`fine-status-badge ${className}`}>
      {label}
    </span>
  );
}

export default FineStatusBadge;
