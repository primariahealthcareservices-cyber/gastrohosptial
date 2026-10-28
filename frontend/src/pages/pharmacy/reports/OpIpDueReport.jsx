import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function OpIpDueReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('All');
  
  const [data, setData] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGetDetails = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/op-ip-due`, {
        params: { 
          start_date: startDate, 
          end_date: endDate, 
          type: type 
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setData(response.data.data);
      setTotalDue(response.data.total_due);
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch report.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (data.length === 0) {
      alert("No data to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OP_IP_Due_Report");
    XLSX.writeFile(wb, `OP_IP_Due_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">OP/IP Due Report</h2>

      {/* Filters */}
      <div className="border p-4 mb-4 bg-gray-50 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input type="date" className="border p-2 rounded" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input type="date" className="border p-2 rounded" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select className="border p-2 rounded" value={type} onChange={(e) => setType(e.target.value)}>
            {/* UPDATED TO MATCH YOUR SCREENSHOT */}
            <option value="All">ALL</option>
            <option value="IP">INPATIENT</option>
            <option value="OP">OUTPATIENT</option>
            <option value="Direct">DIRECT</option>
          </select>
        </div>
        <button onClick={handleGetDetails} className="bg-[#5bc0de] text-white px-6 py-2 rounded hover:bg-blue-400" disabled={loading}>
          {loading ? 'Loading...' : 'Get In Detail'}
        </button>
        
        {data.length > 0 && (
          <button onClick={handleExport} className="bg-[#d9534f] text-white px-4 py-2 rounded hover:bg-red-600 ml-auto">
            Export To Excel
          </button>
        )}
      </div>

      {error && <div className="text-red-500 mb-4 font-bold">{error}</div>}

      {/* Summary Bar */}
      {data.length > 0 && (
        <div className="bg-gray-100 p-3 mb-4 text-right font-bold text-lg border border-gray-300">
          Total Outstanding Due: <span className="text-red-600">₹{totalDue.toFixed(2)}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto text-sm">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-[#3498db] text-white">
              <th className="border p-2 text-left">S.No</th>
              <th className="border p-2 text-left">Date</th>
              <th className="border p-2 text-left">Invoice No</th>
              <th className="border p-2 text-left">Reg No</th>
              <th className="border p-2 text-left">Patient Name</th>
              <th className="border p-2 text-left">Phone</th>
              <th className="border p-2 text-left">Type</th>
              <th className="border p-2 text-left">Doctor</th>
              <th className="border p-2 text-left">Billed By</th>
              <th className="border p-2 text-right">Final Amount</th>
              <th className="border p-2 text-right">Paid Amount</th>
              <th className="border p-2 text-right">Due Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={12} className="text-center p-6 text-gray-500">
                  No outstanding dues found for the selected period.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={row.id} className="border-b hover:bg-gray-50">
                <td className="border p-2">{index + 1}</td>
                <td className="border p-2">{new Date(row.created_at).toLocaleDateString('en-GB')}</td>
                <td className="border p-2">{row.invoice_no}</td>
                <td className="border p-2">{row.patient_reg_no}</td>
                <td className="border p-2 font-semibold">{row.patient_name || 'Walk-in'}</td>
                <td className="border p-2">{row.phone_number || '-'}</td>
                <td className="border p-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${row.patient_type === 'OP' ? 'bg-green-100 text-green-700' : row.patient_type === 'IP' ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-700'}`}>
                    {row.patient_type}
                  </span>
                </td>
                <td className="border p-2">{row.doctor_name || '-'}</td>
                <td className="border p-2">{row.billed_by || '-'}</td>
                <td className="border p-2 text-right">{parseFloat(row.final_amount).toFixed(2)}</td>
                <td className="border p-2 text-right text-green-600">{parseFloat(row.paid_amount).toFixed(2)}</td>
                <td className="border p-2 text-right font-bold text-red-600">{parseFloat(row.due_amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}