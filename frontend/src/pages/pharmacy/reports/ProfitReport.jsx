import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function ProfitReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [doctorId, setDoctorId] = useState('All');
  const [pType, setPType] = useState('All');

  const [doctors, setDoctors] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch doctors on mount
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/reports/dropdown-doctors`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDoctors(res.data);
      } catch (err) {
        console.error("Failed to load doctors", err);
      }
    };
    fetchDoctors();
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
      const response = await axios.get(`http://localhost:5000/api/reports/profit-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          doctor_id: doctorId,
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
    if (data.length === 0) {
      alert("No data to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Profit_Report");
    XLSX.writeFile(wb, `Profit_Report_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Profit Report</h2>

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
          <label className="block text-sm font-bold mb-2">Doctor</label>
          <select 
            className="border border-gray-300 p-2 rounded w-48 text-sm focus:outline-none focus:border-blue-500" 
            value={doctorId} 
            onChange={(e) => setDoctorId(e.target.value)}
          >
            <option value="All">--All--</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Patient Type</label>
          <select 
            className="border border-gray-300 p-2 rounded w-40 text-sm focus:outline-none focus:border-blue-500" 
            value={pType} 
            onChange={(e) => setPType(e.target.value)}
          >
            <option value="All">All</option>
            <option value="OP">OP</option>
            <option value="IP">IP</option>
            <option value="Direct">Direct</option>
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
        <table className="w-full text-sm text-center border-collapse min-w-[1200px]">
          <thead className="bg-[#3498db] text-white">
            {/* Top Level Headers */}
            <tr>
              <th className="border border-[#2980b9] p-3" rowSpan={2}>Month</th>
              <th className="border border-[#2980b9] p-3" rowSpan={2}>Sale Mrp Value</th>
              <th className="border border-[#2980b9] p-3" rowSpan={2}>Discount Amount(₹)</th>
              
              <th className="border border-[#2980b9] p-3" colSpan={3}>Sale Value(₹)</th>
              <th className="border border-[#2980b9] p-3" colSpan={3}>Return Sale Value(₹)</th>
              
              <th className="border border-[#2980b9] p-3" rowSpan={2}>Net Rate(Inc. GST)(₹)</th>
              <th className="border border-[#2980b9] p-3" rowSpan={2}>Profit(₹)</th>
            </tr>
            
            {/* Sub Headers */}
            <tr>
              <th className="border border-[#2980b9] p-2 border-t-0">Gross</th>
              <th className="border border-[#2980b9] p-2 border-t-0">Tax</th>
              <th className="border border-[#2980b9] p-2 border-t-0">Total</th>
              
              <th className="border border-[#2980b9] p-2 border-t-0">Gross</th>
              <th className="border border-[#2980b9] p-2 border-t-0">Tax</th>
              <th className="border border-[#2980b9] p-2 border-t-0">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={11} className="p-6 text-gray-500">
                  No data available for the selected period.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-3 font-semibold">{row.month}</td>
                <td className="border p-3 text-right">₹{parseFloat(row.sale_mrp_value || 0).toFixed(2)}</td>
                <td className="border p-3 text-right">₹0.00</td>
                
                {/* Sales */}
                <td className="border p-3 text-right text-green-700">₹{parseFloat(row.gross_sales || 0).toFixed(2)}</td>
                <td className="border p-3 text-right text-green-700">₹{parseFloat(row.sales_tax || 0).toFixed(2)}</td>
                <td className="border p-3 text-right font-bold text-green-700">₹{parseFloat(row.total_sales || 0).toFixed(2)}</td>
                
                {/* Returns */}
                <td className="border p-3 text-right text-red-500">₹{parseFloat(row.return_gross || 0).toFixed(2)}</td>
                <td className="border p-3 text-right text-red-500">₹{parseFloat(row.return_tax || 0).toFixed(2)}</td>
                <td className="border p-3 text-right font-bold text-red-500">₹{parseFloat(row.total_returns || 0).toFixed(2)}</td>
                
                {/* Net & Profit */}
                <td className="border p-3 text-right font-bold text-blue-700">₹{parseFloat(row.net_rate || 0).toFixed(2)}</td>
                <td className="border p-3 text-right font-bold text-purple-700">₹{parseFloat(row.profit || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}