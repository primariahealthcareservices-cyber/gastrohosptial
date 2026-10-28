import React, { useState, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function GrnAdjustmentReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Table Controls
  const [entriesPerPage, setEntriesPerPage] = useState(10);
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
      const response = await axios.get(`http://localhost:5000/api/reports/grn-adjustment-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data.data);
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
    XLSX.utils.book_append_sheet(wb, ws, "GRN_Adjustment_Report");
    XLSX.writeFile(wb, `GRN_Adjustment_${startDate}_to_${endDate}.xlsx`);
  };

  // Pagination Logic
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = data.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(data.length / entriesPerPage);

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">GRN Adjustment Report</h2>

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
            onClick={handleGetData} 
            className="bg-[#337ab7] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-700" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get Data'}
          </button>
        </div>
        
        {data.length > 0 && (
          <div>
            <button 
              onClick={handleExport} 
              className="bg-[#d9534f] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-red-600"
            >
              Export
            </button>
          </div>
        )}
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Display */}
      <div className="border border-gray-300 shadow-sm">
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-[#3498db] text-white">
              <tr>
                <th className="border p-3 font-semibold text-left">Grn No.</th>
                <th className="border p-3 font-semibold text-left">Grn Date</th>
                <th className="border p-3 font-semibold text-left">Invoice No</th>
                <th className="border p-3 font-semibold text-left">Invoice Date</th>
                <th className="border p-3 font-semibold text-left">Supplier</th>
                <th className="border p-3 font-semibold text-right">Net Amount</th>
                <th className="border p-3 font-semibold text-right">Other Amount</th>
                <th className="border p-3 font-semibold text-right">Adjustment Amount</th>
                <th className="border p-3 font-semibold text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="p-4 text-gray-500 border">
                    Details not available.
                  </td>
                </tr>
              )}

              {currentEntries.map((row, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="border p-3">{row.grn_no}</td>
                  <td className="border p-3">{new Date(row.grn_date).toLocaleDateString('en-GB')}</td>
                  <td className="border p-3">{row.invoice_no}</td>
                  <td className="border p-3">{row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('en-GB') : '-'}</td>
                  <td className="border p-3">{row.supplier_name || '-'}</td>
                  <td className="border p-3 text-right">₹{parseFloat(row.net_amount || 0).toFixed(2)}</td>
                  <td className="border p-3 text-right">₹{parseFloat(row.other_amount || 0).toFixed(2)}</td>
                  <td className="border p-3 text-right">₹{parseFloat(row.adjustment_amount || 0).toFixed(2)}</td>
                  <td className="border p-3 text-right font-bold text-green-700">₹{parseFloat(row.total_amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50 text-sm text-gray-600">
          <div>
            Showing {data.length > 0 ? indexOfFirstEntry + 1 : 0} to {Math.min(indexOfLastEntry, data.length)} of {data.length} entries
          </div>
          <div className="flex gap-1">
            <button 
              className="border px-3 py-1 rounded bg-white hover:bg-gray-100 disabled:opacity-50" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              &laquo;
            </button>
            <button 
              className="border px-3 py-1 rounded bg-white hover:bg-gray-100 disabled:opacity-50" 
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