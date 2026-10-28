import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function MinimumStockReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch data automatically on page load
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/api/reports/minimum-stock-report`, {
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
    fetchData();
  }, []);

  const handleExport = () => {
    if (data.length === 0) {
      alert("No data to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Minimum_Stock_Report");
    XLSX.writeFile(wb, `Minimum_Stock_Report.xlsx`);
  };

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      row.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.item_type && row.item_type.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [data, searchTerm]);

  // Pagination Logic
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredData.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredData.length / entriesPerPage);

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Minimum Stock Report</h2>

      {/* Top Actions */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex justify-between items-center">
        <button 
          onClick={handleExport} 
          className="bg-[#d9534f] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-red-600" 
          disabled={data.length === 0}
        >
          Export
        </button>
        
        <div className="flex items-center gap-2 text-sm font-bold">
          <label>Search:</label>
          <input 
            type="text" 
            placeholder="Item Name"
            className="border border-gray-300 p-2 rounded w-64 text-sm focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-center border-collapse min-w-[800px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-3 font-semibold">SNo</th>
              <th className="border p-3 font-semibold text-left">ItemType</th>
              <th className="border p-3 font-semibold text-left">ItemName</th>
              <th className="border p-3 font-semibold">Min Stock Qty</th>
              <th className="border p-3 font-semibold">CurrentStock Qty</th>
            </tr>
          </thead>
          <tbody>
            {currentEntries.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-8 text-gray-400 border">
                  No data available.
                </td>
              </tr>
            )}

            {currentEntries.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-3">{indexOfFirstEntry + index + 1}</td>
                <td className="border p-3 text-left">{row.item_type || '-'}</td>
                <td className="border p-3 text-left font-semibold text-blue-700">{row.item_name}</td>
                <td className="border p-3 font-bold">{row.min_stock_qty}</td>
                <td className="border p-3 font-bold text-red-600">{row.current_stock_qty}</td>
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
  );
}