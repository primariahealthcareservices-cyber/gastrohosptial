import React, { useState } from 'react';
import axios from 'axios';

export default function InvoiceTaxReport() {
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
      const response = await axios.get(`http://localhost:5000/api/reports/invoice-tax-report`, {
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
      <h2 className="text-xl font-bold mb-4">Invoice Tax Report</h2>

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
            className="border border-gray-300 p-2 rounded w-32 text-sm focus:outline-none focus:border-blue-500" 
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

      {/* Report Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          Sales Report
        </div>

        <table className="w-full text-sm text-center border-collapse min-w-[1200px]">
          <thead className="bg-[#3498db] text-white">
            {/* Top Level Headers */}
            <tr>
              <th className="border border-[#2980b9] p-2" rowSpan={2}>Date</th>
              <th className="border border-[#2980b9] p-2" rowSpan={2}>Patient<br/>RegNo</th>
              <th className="border border-[#2980b9] p-2" rowSpan={2}>Patient<br/>Name</th>
              <th className="border border-[#2980b9] p-2" rowSpan={2}>Invoice<br/>No</th>
              <th className="border border-[#2980b9] p-2" rowSpan={2}>Invoice<br/>Total</th>
              
              <th className="border border-[#2980b9] p-2" colSpan={4}>Gross(₹)</th>
              <th className="border border-[#2980b9] p-2" colSpan={4}>Tax(₹)</th>
              
              <th className="border border-[#2980b9] p-2" rowSpan={2}>Total</th>
            </tr>
            
            {/* Sub Headers */}
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
                <td colSpan={14} className="p-6 text-gray-500 border">
                  No data available for the selected period.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-2 font-semibold">
                  {new Date(row.report_date).toLocaleDateString('en-GB')}
                </td>
                <td className="border p-2">{row.patient_reg_no || '-'}</td>
                <td className="border p-2 text-left">{row.patient_name || 'Walk-in'}</td>
                <td className="border p-2 text-blue-600">{row.invoice_no}</td>
                <td className="border p-2 text-right font-bold">₹{parseFloat(row.invoice_total || 0).toFixed(2)}</td>
                
                {/* Gross Amounts */}
                <td className="border p-2 text-right">{parseFloat(row.gross_0 || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">{parseFloat(row.gross_5 || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">{parseFloat(row.gross_12 || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">{parseFloat(row.gross_18 || 0).toFixed(2)}</td>
                
                {/* Tax Amounts */}
                <td className="border p-2 text-right text-green-700">{parseFloat(row.tax_0 || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-green-700">{parseFloat(row.tax_5 || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-green-700">{parseFloat(row.tax_12 || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-green-700">{parseFloat(row.tax_18 || 0).toFixed(2)}</td>
                
                {/* Total Tax */}
                <td className="border p-2 text-right font-bold text-red-600">₹{parseFloat(row.total_tax || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}