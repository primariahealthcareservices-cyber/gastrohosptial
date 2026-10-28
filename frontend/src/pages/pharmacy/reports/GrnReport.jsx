import React, { useState } from 'react';
import axios from 'axios';

export default function GrnReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('Daily');

  const [data, setData] = useState([]);
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
      const response = await axios.get(`http://localhost:5000/api/reports/grn-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          type: type
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">GRN Report</h2>

      {/* Top Filters */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-sm font-bold mb-2">Start Date</label>
          <input 
            type="date" 
            className="border border-gray-300 p-2 rounded w-48 text-sm focus:outline-none focus:border-blue-500" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">End Date</label>
          <input 
            type="date" 
            className="border border-gray-300 p-2 rounded w-48 text-sm focus:outline-none focus:border-blue-500" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Type</label>
          <select 
            className="border border-gray-300 p-2 rounded w-40 text-sm focus:outline-none focus:border-blue-500" 
            value={type} 
            onChange={(e) => setType(e.target.value)}
          >
            <option value="Daily">Daily</option>
            <option value="Monthly">Monthly</option>
            <option value="Yearly">Yearly</option>
          </select>
        </div>
        
        <div>
          <button 
            onClick={handleGetDetails} 
            className="bg-[#5bc0de] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get In Detail'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Display */}
      <div className="border border-gray-300 shadow-sm">
        
        {/* Section Title */}
        <div className="bg-white border-t-4 border-[#3498db] p-3 font-bold text-gray-800">
          Goods Received Note Report
        </div>

        {/* Horizontal Scroll Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center border-collapse min-w-[800px]">
            <thead className="bg-[#f8f9fa] text-gray-700 border-b">
              <tr>
                <th className="border p-3 font-bold">Date</th>
                <th className="border p-3 font-bold">Total GRNs</th>
                <th className="border p-3 font-bold">Total Value</th>
                <th className="border p-3 font-bold">Total Discount</th>
                <th className="border p-3 font-bold">Total Tax</th>
                <th className="border p-3 font-bold">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-gray-400">
                    No data available for the selected period.
                  </td>
                </tr>
              )}

              {data.map((row, index) => {
                // Format date string nicely depending on the type
                let displayDate = row.report_date;
                if (type === 'Daily') {
                  displayDate = new Date(row.report_date).toLocaleDateString('en-GB');
                }

                return (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="border p-3 font-semibold">{displayDate}</td>
                    <td className="border p-3 text-blue-600 font-bold">{row.total_grns}</td>
                    <td className="border p-3 text-right">₹{parseFloat(row.total_value || 0).toFixed(2)}</td>
                    <td className="border p-3 text-right text-red-500">-₹{parseFloat(row.total_discount || 0).toFixed(2)}</td>
                    <td className="border p-3 text-right">₹{parseFloat(row.total_tax || 0).toFixed(2)}</td>
                    <td className="border p-3 text-right font-bold text-green-700">₹{parseFloat(row.grand_total || 0).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}