import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

export default function SupplierWiseItemPurchase() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [supplierId, setSupplierId] = useState('Select');

  const [suppliers, setSuppliers] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch suppliers on mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/reports/dropdown-suppliers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuppliers(res.data);
      } catch (err) {
        console.error("Failed to load suppliers", err);
      }
    };
    fetchSuppliers();
  }, []);

  const handleGetData = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/supplier-wise-item-purchase`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          supplier_id: supplierId
        },
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

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      row.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // Pagination Logic
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = filteredData.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(filteredData.length / entriesPerPage);

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Supplier Wise Item Purchase Report</h2>

      {/* Top Filters */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex flex-wrap gap-4 items-end">
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
          <label className="block text-sm font-bold mb-2">Supplier</label>
          <select 
            className="border border-gray-300 p-2 rounded w-64 text-sm focus:outline-none focus:border-blue-500" 
            value={supplierId} 
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="Select">Select</option>
            <option value="All">All</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <button 
            onClick={handleGetData} 
            className="bg-[#5bc0de] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get Data'}
          </button>
        </div>
        
        <div className="ml-auto flex items-center gap-2 text-sm font-bold">
          <label>Search:</label>
          <input 
            type="text" 
            placeholder="ItemName"
            className="border border-gray-300 p-2 rounded w-48 text-sm focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-center border-collapse min-w-[600px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-3 font-semibold text-left">Item Name</th>
              <th className="border p-3 font-semibold">Purchase Qty</th>
            </tr>
          </thead>
          <tbody>
            {currentEntries.length === 0 && !loading && (
              <tr>
                <td colSpan={2} className="p-4 text-gray-500 border">
                  Details not available.
                </td>
              </tr>
            )}

            {currentEntries.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-3 text-left font-semibold text-blue-700">{row.item_name}</td>
                <td className="border p-3 font-bold">{row.purchase_qty}</td>
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