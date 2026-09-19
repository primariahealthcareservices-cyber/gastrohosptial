import { useState } from "react";
import api from "../../api/axios";

export default function DailyCollection() {
  const [from, setFrom] = useState("2025-04-01");
  const [to, setTo]     = useState("2025-04-30");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/superadmin/daily-collection?from=${from}&to=${to}`);
      setRows(res.data.data || []);
    } catch (e) {
      alert(e.response?.data?.error || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const totals = rows.reduce((acc, r) => ({
    op:      acc.op + Number(r.op_amount || 0),
    opLab:   acc.opLab + Number(r.op_lab_amount || 0),
    opRad:   acc.opRad + Number(r.op_radiology_amount || 0),
    ip:      acc.ip + Number(r.ip_amount || 0),
    direct:  acc.direct + Number(r.direct_amount || 0),
    total:   acc.total + Number(r.total_amount || 0),
    grand:   acc.grand + Number(r.grand_total || 0),
  }), { op: 0, opLab: 0, opRad: 0, ip: 0, direct: 0, total: 0, grand: 0 });

  return (
    <div style={{ padding: 24 }}>
      <h2>Daily Collection Summary</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button onClick={load} disabled={loading}>{loading ? "Loading..." : "Load"}</button>
      </div>

      <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "#f0f0f0" }}>
          <tr>
            <th>Date</th><th>OP</th><th>OP Lab</th><th>OP Rad</th>
            <th>IP</th><th>Direct</th><th>Total</th><th>Grand</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.summary_date}</td>
              <td>₹{Number(r.op_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.op_lab_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.op_radiology_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.ip_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.direct_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.total_amount).toLocaleString("en-IN")}</td>
              <td><b>₹{Number(r.grand_total).toLocaleString("en-IN")}</b></td>
            </tr>
          ))}
        </tbody>
        <tfoot style={{ background: "#fafafa", fontWeight: 600 }}>
          <tr>
            <td>Totals</td>
            <td>₹{totals.op.toLocaleString("en-IN")}</td>
            <td>₹{totals.opLab.toLocaleString("en-IN")}</td>
            <td>₹{totals.opRad.toLocaleString("en-IN")}</td>
            <td>₹{totals.ip.toLocaleString("en-IN")}</td>
            <td>₹{totals.direct.toLocaleString("en-IN")}</td>
            <td>₹{totals.total.toLocaleString("en-IN")}</td>
            <td>₹{totals.grand.toLocaleString("en-IN")}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}import { useState } from "react";
import api from "../../api/axios";

export default function DailyCollection() {
  const [from, setFrom] = useState("2025-04-01");
  const [to, setTo]     = useState("2025-04-30");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/superadmin/daily-collection?from=${from}&to=${to}`);
      setRows(res.data.data || []);
    } catch (e) {
      alert(e.response?.data?.error || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const totals = rows.reduce((acc, r) => ({
    op:      acc.op + Number(r.op_amount || 0),
    opLab:   acc.opLab + Number(r.op_lab_amount || 0),
    opRad:   acc.opRad + Number(r.op_radiology_amount || 0),
    ip:      acc.ip + Number(r.ip_amount || 0),
    direct:  acc.direct + Number(r.direct_amount || 0),
    total:   acc.total + Number(r.total_amount || 0),
    grand:   acc.grand + Number(r.grand_total || 0),
  }), { op: 0, opLab: 0, opRad: 0, ip: 0, direct: 0, total: 0, grand: 0 });

  return (
    <div style={{ padding: 24 }}>
      <h2>Daily Collection Summary</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <button onClick={load} disabled={loading}>{loading ? "Loading..." : "Load"}</button>
      </div>

      <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "#f0f0f0" }}>
          <tr>
            <th>Date</th><th>OP</th><th>OP Lab</th><th>OP Rad</th>
            <th>IP</th><th>Direct</th><th>Total</th><th>Grand</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.summary_date}</td>
              <td>₹{Number(r.op_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.op_lab_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.op_radiology_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.ip_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.direct_amount).toLocaleString("en-IN")}</td>
              <td>₹{Number(r.total_amount).toLocaleString("en-IN")}</td>
              <td><b>₹{Number(r.grand_total).toLocaleString("en-IN")}</b></td>
            </tr>
          ))}
        </tbody>
        <tfoot style={{ background: "#fafafa", fontWeight: 600 }}>
          <tr>
            <td>Totals</td>
            <td>₹{totals.op.toLocaleString("en-IN")}</td>
            <td>₹{totals.opLab.toLocaleString("en-IN")}</td>
            <td>₹{totals.opRad.toLocaleString("en-IN")}</td>
            <td>₹{totals.ip.toLocaleString("en-IN")}</td>
            <td>₹{totals.direct.toLocaleString("en-IN")}</td>
            <td>₹{totals.total.toLocaleString("en-IN")}</td>
            <td>₹{totals.grand.toLocaleString("en-IN")}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}