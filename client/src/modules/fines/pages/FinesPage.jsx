
import { useState } from "react";
import { Receipt } from "lucide-react";
import FineRulesPage from "./FineRulesPage";
import FineRecordsPage from "./FineRecordsPage";
import FinePaymentsPage from "./FinePaymentsPage";
import FineWithdrawalsPage from "./FineWithdrawalsPage";
import "../fines.css";

function FinesPage({ user }) {
  const role = (user?.role || "").toLowerCase();

  const [activeTab, setActiveTab] = useState("records");

  const tabs = [
    {
      key: "records",
      label: "Fine Records",
      allowed: ["member", "treasurer", "chairperson"],
    },
    {
      key: "rules",
      label: "Fine Rules",
      allowed: ["member", "secretary", "treasurer", "chairperson"],
    },
    {
      key: "payments",
      label: "Payments",
      allowed: ["member", "treasurer", "chairperson"],
    },
    {
      key: "withdrawals",
      label: "Withdrawals",
      allowed: ["treasurer", "chairperson"],
    },
  ];

  const visibleTabs = tabs.filter((tab) => tab.allowed.includes(role));

  const currentTab = visibleTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : visibleTabs[0]?.key || "records";

  function renderActivePage() {
    switch (currentTab) {
      case "rules":
        return <FineRulesPage user={user} role={role} />;

      case "payments":
        return <FinePaymentsPage user={user} role={role} />;

      case "withdrawals":
        return <FineWithdrawalsPage user={user} role={role} />;

      case "records":
      default:
        return <FineRecordsPage user={user} role={role} />;
    }
  }

  return (
    <main className="fines-module">
      <header className="fines-module-header">
        <div>
          <span className="fines-module-eyebrow">FINANCIAL OVERSIGHT</span>
          <h1>Fine Management</h1>
          <p>
            Manage fine rules, issued fines, payments and withdrawals.
          </p>
        </div>
        <span className="fines-module-mark" aria-hidden="true">
          <Receipt size={27} strokeWidth={1.7} />
        </span>
      </header>

      <nav className="fine-tabs" aria-label="Fine management sections">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={
              currentTab === tab.key
                ? "fine-tab fine-tab-active"
                : "fine-tab"
            }
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="fine-tab-content">
        {renderActivePage()}
      </div>
    </main>
  );
}

export default FinesPage;
