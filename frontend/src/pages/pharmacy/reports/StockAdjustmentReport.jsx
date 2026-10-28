import React, { useState } from 'react';
import axios from 'axios';

export default function StockAdjustmentReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
      const response = await axios.get(`http://localhost:5000/api/reports/stock-adjustment-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate
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
      <h2 className="text-xl font-bold mb-4">Stock Adjustment Report</h2>

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

      {/* Report Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          Stock Adjustment Report
        </div>

        <table className="w-full text-sm text-center border-collapse min-w-[800px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-3 font-semibold">Date</th>
              <th className="border p-3 font-semibold text-left">Item Name</th>
              <th className="border p-3 font-semibold">Quantity</th>
              <th className="border p-3 font-semibold text-left">Remarks</th>
              <th className="border p-3 font-semibold text-left">Adjusted By</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-8 text-gray-400 border">
                  No data available for the selected period.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-3">{new Date(row.adjustment_date).toLocaleDateString('en-GB')}</td>
                <td className="border p-3 text-left font-semibold text-blue-700">{row.item_name || '-'}</td>
                <td className={`border p-3 font-bold ${row.quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {row.quantity}
                </td>
                <td className="border p-3 text-left text-gray-600">{row.remarks || '-'}</td>
                <td className="border p-3 text-left text-gray-600">{row.adjusted_by || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}