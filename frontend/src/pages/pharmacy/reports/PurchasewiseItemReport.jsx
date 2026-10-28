import React, { useState, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function ProductWiseSalesReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Table Controls
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const handleGetData = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/product-wise-sales`, {
        params: { start_date: startDate, end_date: endDate },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
      setCurrentPage(1); 
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
    XLSX.utils.book_append_sheet(wb, ws, "Product_Wise_Sales");
    XLSX.writeFile(wb, `Product_Wise_Sales_${startDate}_to_${endDate}.xlsx`);
  };

  // Filter data based on search term (Product Name)
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      row.item_name && row.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // Pagination Logic
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredData.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredData.length / entriesPerPage);

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Product Wise Sales Report</h2>

      {/* Top Filters */}
      <div className="border p-4 mb-4 bg-gray-50 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input type="date" className="border p-2 rounded" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input type="date" className="border p-2 rounded" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <button onClick={handleGetData} className="bg-[#5bc0de] text-white px-6 py-2 rounded hover:bg-blue-400" disabled={loading}>
          {loading ? 'Loading...' : 'Get Data'}
        </button>
        <button onClick={handleExport} className="bg-[#d9534f] text-white px-6 py-2 rounded hover:bg-red-600" disabled={data.length === 0}>
          Export
        </button>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold">{error}</div>}

      {/* Table Container */}
      <div className="border border-gray-300 p-4">
        
        {/* Table Header Controls (Show entries & Search) */}
        <div className="flex justify-between items-center mb-4 text-sm">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select 
              className="border p-1 rounded" 
              value={entriesPerPage} 
              onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Search Product:</span>
            <input 
              type="text" 
              className="border p-1 rounded" 
              placeholder="Item Name"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300 text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-[#3498db] text-white text-left">
                <th className="border p-2 w-16 text-center">S.No</th>
                <th className="border p-2">Product Name</th>
                <th className="border p-2 text-right">Total Qty Sold</th>
                <th className="border p-2 text-right">Avg. Selling Rate (₹)</th>
                <th className="border p-2 text-right">Total Revenue (₹)</th>
              </tr>
            </thead>
            <tbody>
              {currentEntries.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center p-4 text-gray-500">
                    No data available in table
                  </td>
                </tr>
              )}

              {currentEntries.map((row, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="border p-2 text-center">{indexOfFirstEntry + index + 1}</td>
                  <td className="border p-2 font-semibold text-blue-700">{row.item_name}</td>
                  <td className="border p-2 text-right font-bold text-gray-800">{row.total_qty_sold}</td>
                  <td className="border p-2 text-right">{parseFloat(row.avg_selling_rate || 0).toFixed(2)}</td>
                  <td className="border p-2 text-right font-bold text-green-600">
                    {parseFloat(row.total_revenue || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
          <div>
            Showing {filteredData.length > 0 ? indexOfFirstEntry + 1 : 0} to {Math.min(indexOfLastEntry, filteredData.length)} of {filteredData.length} entries
          </div>
          <div className="flex gap-1">
            <button 
              className="border px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              &laquo;
            </button>
            <button 
              className="border px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              &raquo;
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}