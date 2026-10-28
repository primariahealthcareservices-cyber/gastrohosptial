import React, { useState, useMemo } from 'react';
import axios from 'axios';

export default function NonMovingStockReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  const handleGetDetails = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/non-moving-stock-report`, {
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

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      row.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.batch_no && row.batch_no.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [data, searchTerm]);

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Non-Moving Stock Report</h2>

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

      {/* Search Bar */}
      <div className="flex justify-end mb-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <label>Search:</label>
          <input 
            type="text" 
            className="border border-gray-300 p-2 rounded w-64 text-sm focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Report Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-center border-collapse min-w-[1000px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-3 font-semibold text-left">Item Name</th>
              <th className="border p-3 font-semibold">Batch No</th>
              <th className="border p-3 font-semibold">Exp Date</th>
              <th className="border p-3 font-semibold">Original StockQty</th>
              <th className="border p-3 font-semibold">Current StockQty</th>
              <th className="border p-3 font-semibold">Mrp</th>
              <th className="border p-3 font-semibold">Rate</th>
              <th className="border p-3 font-semibold">Non-Moving(Percentage)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="p-8 text-gray-400 border">
                  No data available for the selected period.
                </td>
              </tr>
            )}

            {filteredData.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-3 text-left font-semibold text-blue-700">{row.item_name}</td>
                <td className="border p-3">{row.batch_no}</td>
                <td className="border p-3">{row.exp_date !== 'N/A' ? new Date(row.exp_date).toLocaleDateString('en-GB') : 'N/A'}</td>
                <td className="border p-3">{row.original_stock_qty}</td>
                <td className="border p-3 font-bold text-red-600">{row.current_stock_qty}</td>
                <td className="border p-3 text-right">₹{parseFloat(row.mrp || 0).toFixed(2)}</td>
                <td className="border p-3 text-right">₹{parseFloat(row.rate || 0).toFixed(2)}</td>
                <td className="border p-3 font-bold text-orange-600">{row.non_moving_percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}