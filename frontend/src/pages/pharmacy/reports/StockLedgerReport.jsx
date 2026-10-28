import React, { useState, useMemo } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function StockLedgerReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');

  const handleGetData = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/stock-ledger-report`, {
        params: { start_date: startDate, end_date: endDate },
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

  const handleExport = () => {
    if (filteredData.length === 0) {
      alert("No data to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock_Ledger");
    XLSX.writeFile(wb, `Stock_Ledger_${startDate}_to_${endDate}.xlsx`);
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    return data.filter(row => 
      row.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Stock Ledger</h2>

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
        
        {/* These are visual elements from the screenshot */}
        <div>
          <label className="block text-sm font-bold mb-2">Select Store</label>
          <select className="border border-gray-300 p-2 rounded w-32 text-sm">
            <option>Main</option>
          </select>
        </div>
        <div className="flex items-center pb-2">
          <input type="checkbox" className="mr-2" />
          <label className="text-sm font-bold">Old Data</label>
        </div>
        
        <div className="flex gap-2 ml-auto">
          <button 
            onClick={handleGetData} 
            className="bg-[#5bc0de] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get Data'}
          </button>
          <button 
            onClick={handleExport} 
            className="bg-[#5bc0de] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" 
            disabled={data.length === 0}
          >
            Export Data
          </button>
        </div>
        
        <div>
           <label className="block text-sm font-bold mb-2">Search:</label>
           <input 
             type="text" 
             placeholder="ItemName"
             className="border border-gray-300 p-2 rounded w-48 text-sm focus:outline-none focus:border-blue-500"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>
      </div>

      {/* Checkboxes */}
      <div className="flex gap-8 mb-4 font-bold text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" defaultChecked /> Stock In:
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" defaultChecked /> Stock Out:
        </label>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-center border-collapse min-w-[1400px]">
          <thead className="bg-[#3498db] text-white">
            {/* Top Row Headers */}
            <tr>
              <th className="border p-2" rowSpan={2}>Item Name</th>
              <th className="border p-2" colSpan={3}>Opening Stock</th>
              <th className="border p-2" colSpan={5}>Stock IN</th>
              <th className="border p-2" colSpan={3}>Stock OUT</th>
              <th className="border p-2" rowSpan={2}>Adjusted Qty</th>
              <th className="border p-2" colSpan={3}>Closing Stock</th>
            </tr>
            
            {/* Sub Row Headers */}
            <tr>
              <th className="border p-2 border-t-0 text-xs">Qty</th>
              <th className="border p-2 border-t-0 text-xs">MRP Value (₹)</th>
              <th className="border p-2 border-t-0 text-xs">Rate Value (Exc. Tax) (₹)</th>
              
              <th className="border p-2 border-t-0 text-xs">Purchases</th>
              <th className="border p-2 border-t-0 text-xs">Store Returns</th>
              <th className="border p-2 border-t-0 text-xs">Sale Return</th>
              <th className="border p-2 border-t-0 text-xs">Purchase Returns</th>
              <th className="border p-2 border-t-0 text-xs">Store Transfers</th>
              
              <th className="border p-2 border-t-0 text-xs">Sales</th>
              
              <th className="border p-2 border-t-0 text-xs">Qty</th>
              <th className="border p-2 border-t-0 text-xs">MRP Value (₹)</th>
              <th className="border p-2 border-t-0 text-xs">Rate Value (Exc. Tax) (₹)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 && !loading && (
              <tr>
                <td colSpan={14} className="p-8 text-gray-400 border">
                  No data available.
                </td>
              </tr>
            )}

            {filteredData.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-2 text-left font-semibold">{row.item_name}</td>
                
                {/* Opening */}
                <td className="border p-2">{row.opening_qty}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.opening_mrp_value).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.opening_rate_value).toFixed(2)}</td>
                
                {/* Stock In */}
                <td className="border p-2 text-green-600 font-bold">{row.in_purchases}</td>
                <td className="border p-2 text-gray-400">0</td> {/* Placeholder for Store Returns */}
                <td className="border p-2 text-gray-400">0</td> {/* Placeholder for Sale Return */}
                <td className="border p-2 text-gray-400">0</td> {/* Placeholder for Purchase Returns */}
                <td className="border p-2 text-gray-400">0</td> {/* Placeholder for Store Transfers */}
                
                {/* Stock Out */}
                <td className="border p-2 text-red-500 font-bold">{row.out_sales}</td>
                
                {/* Adjusted */}
                <td className="border p-2">{row.adjusted_qty}</td>
                
                {/* Closing */}
                <td className="border p-2 font-bold">{row.closing_qty}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.closing_mrp_value).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.closing_rate_value).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}