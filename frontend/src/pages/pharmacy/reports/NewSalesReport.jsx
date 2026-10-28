import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function NewSalesReport() {
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
      const response = await axios.get(`http://localhost:5000/api/reports/new-sales-report`, {
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

  const handleExport = () => {
    if (data.length === 0) {
      alert("No data to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sale_Tax_Report");
    XLSX.writeFile(wb, `Sale_Tax_Report_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Sale Tax Report</h2>

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
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        
        {/* Section Title */}
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          Sales Report
        </div>

        {/* Table */}
        <table className="w-full text-sm text-center border-collapse min-w-[1000px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border border-[#2980b9] p-3">Date</th>
              <th className="border border-[#2980b9] p-3">Total Value</th>
              <th className="border border-[#2980b9] p-3">GST(%)</th>
              <th className="border border-[#2980b9] p-3">Total Taxable</th>
              <th className="border border-[#2980b9] p-3">CGST(%)</th>
              <th className="border border-[#2980b9] p-3">CGST Value</th>
              <th className="border border-[#2980b9] p-3">SGST(%)</th>
              <th className="border border-[#2980b9] p-3">SGST Value</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="p-6 text-gray-500">
                  No data available for the selected dates.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-3 font-semibold">{new Date(row.report_date).toLocaleDateString('en-GB')}</td>
                <td className="border p-3 text-right">₹{parseFloat(row.total_value || 0).toFixed(2)}</td>
                <td className="border p-3 text-center">{parseFloat(row.gst_percent || 0).toFixed(2)}%</td>
                <td className="border p-3 text-right">₹{parseFloat(row.total_taxable || 0).toFixed(2)}</td>
                <td className="border p-3 text-center">{parseFloat(row.cgst_percent || 0).toFixed(2)}%</td>
                <td className="border p-3 text-right text-green-700 font-bold">₹{parseFloat(row.cgst_value || 0).toFixed(2)}</td>
                <td className="border p-3 text-center">{parseFloat(row.sgst_percent || 0).toFixed(2)}%</td>
                <td className="border p-3 text-right text-green-700 font-bold">₹{parseFloat(row.sgst_value || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}