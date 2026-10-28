import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function PharmacyDueReceivedReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState([]);
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
      // 1. We added /api to the URL to match your app.py
      // 2. We grab the token from localStorage so @jwt_required() passes
      const token = localStorage.getItem('token'); 
      
      const response = await axios.get(`http://localhost:5000/api/reports/pharmacy-due-received`, {
        params: { start_date: startDate, end_date: endDate },
        headers: {
          Authorization: `Bearer ${token}` 
        }
      });
      setReportData(response.data);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to fetch report. Please check if the database table exists.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    if (reportData.length === 0) return;
    
    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Due Received");
    XLSX.writeFile(wb, `Pharmacy_Due_Received_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Pharmacy Due Received Report</h2>

      <div className="border p-4 mb-4 bg-gray-50 flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            className="border p-2 rounded w-48"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            className="border p-2 rounded w-48"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button
          onClick={handleGetDetails}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Get In Detail'}
        </button>
        <button
          onClick={handleExportExcel}
          className="bg-red-400 text-white px-4 py-2 rounded hover:bg-red-500 ml-2"
          disabled={reportData.length === 0}
        >
          Export To Excel
        </button>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold">{error}</div>}

      {reportData.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr className="bg-[#3498db] text-white">
                <th className="border p-2 text-left">S.No</th>
                <th className="border p-2 text-left">Patient RegNo</th>
                <th className="border p-2 text-left">Patient Name</th>
                <th className="border p-2 text-left">Phone Number</th>
                <th className="border p-2 text-left">Invoice No</th>
                <th className="border p-2 text-left">Bill Date</th>
                <th className="border p-2 text-left">Created By</th>
                <th className="border p-2 text-left">Patient Type</th>
                <th className="border p-2 text-right">Due Received Amount</th>
                <th className="border p-2 text-right">Due Discount Amount</th>
                <th className="border p-2 text-left">Due Received Date</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, index) => (
                <tr key={row.id} className="hover:bg-gray-100">
                  <td className="border p-2">{index + 1}</td>
                  <td className="border p-2">{row.patient_reg_no || 'N/A'}</td>
                  <td className="border p-2">{row.patient_name || 'N/A'}</td>
                  <td className="border p-2">{row.phone_number || 'N/A'}</td>
                  <td className="border p-2">{row.invoice_no}</td>
                  <td className="border p-2">{row.bill_date ? row.bill_date.split('T')[0] : ''}</td>
                  <td className="border p-2">{row.created_by || 'N/A'}</td>
                  <td className="border p-2">{row.patient_type}</td>
                  <td className="border p-2 text-right font-semibold text-green-700">
                    {parseFloat(row.due_received_amount || 0).toFixed(2)}
                  </td>
                  <td className="border p-2 text-right">
                    {parseFloat(row.due_discount_amount || 0).toFixed(2)}
                  </td>
                  <td className="border p-2">
                    {row.due_received_date ? new Date(row.due_received_date).toLocaleString() : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && reportData.length === 0 && !error && (
        <div className="text-center text-gray-500 mt-10">
          No due received records found for the selected dates.
        </div>
      )}
    </div>
  );
}