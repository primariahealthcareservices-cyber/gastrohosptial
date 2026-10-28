import React, { useState } from 'react';
import axios from 'axios';

export default function SalesReturns() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
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
      // Calling the new backend endpoint
      const response = await axios.get(`http://localhost:5000/api/reports/sales-returns`, {
        params: { start_date: startDate, end_date: endDate },
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Sales Returns</h2>

      {/* Yellow Warning Banner (Matches your screenshot) */}
      <div className="bg-[#f0ad4e] text-white p-3 mb-4 rounded">
        Select Date Range To Get Sales Stock Income
      </div>

      {/* Filter Section */}
      <div className="border p-4 mb-6 bg-gray-50 flex items-end gap-4 flex-wrap">
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
          className="bg-[#5bc0de] text-white px-4 py-2 rounded hover:bg-blue-400"
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Get In Detail'}
        </button>
        <button
          onClick={() => window.print()}
          className="bg-[#5bc0de] text-white px-4 py-2 rounded hover:bg-blue-400 ml-2"
        >
          Print
        </button>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold">{error}</div>}

      {/* Report Results Section */}
      {reportData && (
        <div className="mt-4">
          <h3 className="text-center font-bold text-lg mb-4">
            Grand Total : {reportData.grand_total.toFixed(2)}
          </h3>

          {/* OP Income Section */}
          <div className="mb-6">
            <div className="bg-white border-b-2 border-blue-500 pb-1 mb-2">
              <h4 className="font-bold text-md text-gray-700">OP Income</h4>
            </div>
            <div className="border p-4 min-h-[60px] text-gray-600">
              {reportData.op_income > 0 
                ? `Total OP Returns: ₹${reportData.op_income.toFixed(2)}`
                : "No data available for this period."}
            </div>
          </div>

          {/* IP Income Section */}
          <div className="mb-6">
            <div className="bg-white border-b-2 border-blue-500 pb-1 mb-2">
              <h4 className="font-bold text-md text-gray-700">IP Income</h4>
            </div>
            <div className="border p-4 min-h-[60px] text-gray-600">
              {reportData.ip_income > 0 
                ? `Total IP Returns: ₹${reportData.ip_income.toFixed(2)}`
                : "No data available for this period."}
            </div>
          </div>

          <h3 className="text-center font-bold text-lg mt-8 mb-4">
            Grand Total : {reportData.grand_total.toFixed(2)}
          </h3>
        </div>
      )}
    </div>
  );
}