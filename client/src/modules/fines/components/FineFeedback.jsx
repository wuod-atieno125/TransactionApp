function FineFeedback({ message, type = "error" }) {
  if (!message) return null;

  const isError = type === "error";

  return (
    <div
      key={`${type}:${message}`}
      className={`fine-alert fine-alert-${type} fine-alert-feedback`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {message}
    </div>
  );
}

export default FineFeedback;
