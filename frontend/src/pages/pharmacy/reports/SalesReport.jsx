import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function SalesReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('Daily');
  const [pType, setPType] = useState('All');

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
      const response = await axios.get(`http://localhost:5000/api/reports/sales-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          type: type,
          ptype: pType
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
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales_Report");
    XLSX.writeFile(wb, `Sales_Report_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Sales Report</h2>

      {/* Top Filters */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-sm font-bold mb-2">Start Date</label>
          <input type="date" className="border border-gray-300 p-2 rounded w-48 text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">End Date</label>
          <input type="date" className="border border-gray-300 p-2 rounded w-48 text-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Type</label>
          <select className="border border-gray-300 p-2 rounded w-40 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="Daily">Daily</option>
            <option value="Monthly">Monthly</option>
            <option value="Yearly">Yearly</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">PType</label>
          <select className="border border-gray-300 p-2 rounded w-40 text-sm" value={pType} onChange={(e) => setPType(e.target.value)}>
            <option value="All">All</option>
            <option value="OP">OP</option>
            <option value="IP">IP</option>
            <option value="Direct">Direct</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={handleGetDetails} className="bg-[#5bc0de] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" disabled={loading}>
            {loading ? 'Loading...' : 'Get In Detail'}
          </button>
          <button onClick={handleExport} className="bg-[#d9534f] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-red-600" disabled={data.length === 0}>
            Export
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Display */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        
        {/* Section Title */}
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          Sales Report
        </div>

        {/* Grouped Table */}
        <table className="w-full text-sm text-center border-collapse min-w-[1000px]">
          <thead className="bg-[#3498db] text-white">
            
            {/* Top Row (Gross & Tax Groupers) */}
            <tr>
              <th className="border border-[#2980b9] p-2" rowSpan={2}>Date</th>
              <th className="border border-[#2980b9] p-2" rowSpan={2}>Bill's<br/>Generated</th>
              <th className="border border-[#2980b9] p-2" colSpan={4}>Gross(₹)</th>
              <th className="border border-[#2980b9] p-2" colSpan={4}>Tax(₹)</th>
              <th className="border border-[#2980b9] p-2" rowSpan={2}>Total</th>
            </tr>
            
            {/* Bottom Row (Percentages) */}
            <tr>
              <th className="border border-[#2980b9] p-2 border-t-0">0(%)</th>
              <th className="border border-[#2980b9] p-2 border-t-0">5(%)</th>
              <th className="border border-[#2980b9] p-2 border-t-0">12(%)</th>
              <th className="border border-[#2980b9] p-2 border-t-0">18(%)</th>
              
              <th className="border border-[#2980b9] p-2 border-t-0">0(%)</th>
              <th className="border border-[#2980b9] p-2 border-t-0">5(%)</th>
              <th className="border border-[#2980b9] p-2 border-t-0">12(%)</th>
              <th className="border border-[#2980b9] p-2 border-t-0">18(%)</th>
            </tr>
          </thead>
          
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="p-6 text-gray-500">
                  No data available for the selected dates.
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
                  <td className="border p-2 font-semibold">{displayDate}</td>
                  <td className="border p-2">{row.bills_generated}</td>
                  
                  {/* Gross */}
                  <td className="border p-2 text-right">{parseFloat(row.gross_0 || 0).toFixed(2)}</td>
                  <td className="border p-2 text-right">{parseFloat(row.gross_5 || 0).toFixed(2)}</td>
                  <td className="border p-2 text-right">{parseFloat(row.gross_12 || 0).toFixed(2)}</td>
                  <td className="border p-2 text-right">{parseFloat(row.gross_18 || 0).toFixed(2)}</td>
                  
                  {/* Tax */}
                  <td className="border p-2 text-right text-green-700">{parseFloat(row.tax_0 || 0).toFixed(2)}</td>
                  <td className="border p-2 text-right text-green-700">{parseFloat(row.tax_5 || 0).toFixed(2)}</td>
                  <td className="border p-2 text-right text-green-700">{parseFloat(row.tax_12 || 0).toFixed(2)}</td>
                  <td className="border p-2 text-right text-green-700">{parseFloat(row.tax_18 || 0).toFixed(2)}</td>
                  
                  {/* Total */}
                  <td className="border p-2 text-right font-bold text-gray-800">{parseFloat(row.total_amount || 0).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}