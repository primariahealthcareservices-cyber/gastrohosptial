import { useState } from "react";
import ImportBills from "./ImportOPDBills";
import ExportOPDBills from "./ExportOPDBills";

const TABS = [
  { key: "opd",             label: "Import OPD Bills" },
  { key: "opd_diagnostics", label: "Import OPD Diagnostics" },
  { key: "lab",             label: "Import Lab Bills" },
  { key: "radiology",       label: "Import Radiology Bills" },
  { key: "daily_summary",   label: "Import Daily Summary" },
  { key: "export",          label: "Export Bills" },
];

export default function BulkImport() {
  const [tab, setTab] = useState("opd");

  return (
    <div style={{ padding: 24 }}>
      <h2>Bulk Data Management</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid #ddd", flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px", border: "none", cursor: "pointer", background: "none",
              borderBottom: tab === t.key ? "2px solid #2563eb" : "2px solid transparent",
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "opd" && (
        <ImportBills importType="opd_bills" label="Import OPD consultation billing CSV/Excel" />
      )}
      {tab === "opd_diagnostics" && (
        <ImportBills
          importType="opd_diagnostics"
          label="Import OPD diagnostics CSV/Excel (Invoice No + Investigations)"
        />
      )}
      {tab === "lab" && (
        <ImportBills importType="lab_bills" label="Import Lab investigation billing CSV/Excel" />
      )}
      {tab === "radiology" && (
        <ImportBills importType="radiology_bills" label="Import Radiology investigation billing CSV/Excel" />
      )}
      {tab === "daily_summary" && (
        <ImportBills
          importType="daily_summary"
          label="Import Daily Collection Summary CSV/Excel (Date + all counts + totals)"
        />
      )}
      {tab === "export" && <ExportOPDBills />}
    </div>
  );
}