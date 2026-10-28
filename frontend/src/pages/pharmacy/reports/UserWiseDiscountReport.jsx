import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function UserWiseDiscountReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userId, setUserId] = useState('All');

  const [users, setUsers] = useState([]);
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({ total_amount: 0, total_discount: 0 });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch users for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/reports/dropdown-users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
      } catch (err) {
        console.error("Failed to load users", err);
      }
    };
    fetchUsers();
  }, []);

  const handleGetDetails = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/user-wise-discount-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          user_id: userId
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data.data);
      setTotals(response.data.totals);
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
    XLSX.utils.book_append_sheet(wb, ws, "User_Wise_Discount_Report");
    XLSX.writeFile(wb, `User_Wise_Discount_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">User Wise Discount Report</h2>

      {/* Top Filters */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-bold mb-2">User</label>
          <select 
            className="border border-gray-300 p-2 rounded w-48 text-sm focus:outline-none focus:border-blue-500" 
            value={userId} 
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="All">All</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
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
        
        <div className="flex gap-2 ml-auto">
          <button 
            onClick={handleGetDetails} 
            className="bg-[#5bc0de] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get In Detail'}
          </button>
          <button 
            onClick={() => window.print()} 
            className="bg-[#5bc0de] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400"
          >
            Print
          </button>
          <button 
            onClick={handleExport} 
            className="bg-[#d9534f] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-red-600"
            disabled={data.length === 0}
          >
            Export To Excel
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800 text-center">
          User Wise Discount Report
        </div>

        <table className="w-full text-sm text-center border-collapse min-w-[1000px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-3 font-semibold">Invoice No</th>
              <th className="border p-3 font-semibold">Patient Reg.No.</th>
              <th className="border p-3 font-semibold text-left">Name</th>
              <th className="border p-3 font-semibold">User Name</th>
              <th className="border p-3 font-semibold">Billed Date</th>
              <th className="border p-3 font-semibold text-right">Total</th>
              <th className="border p-3 font-semibold text-right">Discount Amount</th>
              <th className="border p-3 font-semibold text-left">Discount Comments</th>
              <th className="border p-3 font-semibold">Bill Type</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="p-8 text-gray-400 border">
                  No data available for the selected period.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-3 text-blue-600">{row.invoice_no}</td>
                <td className="border p-3">{row.patient_reg_no || '-'}</td>
                <td className="border p-3 text-left font-semibold">{row.patient_name || 'Walk-in'}</td>
                <td className="border p-3">{row.user_name || '-'}</td>
                <td className="border p-3">{new Date(row.billed_date).toLocaleDateString('en-GB')}</td>
                <td className="border p-3 text-right font-bold">₹{parseFloat(row.total || 0).toFixed(2)}</td>
                <td className="border p-3 text-right font-bold text-red-600">₹{parseFloat(row.discount_amount || 0).toFixed(2)}</td>
                <td className="border p-3 text-left text-gray-600">{row.discount_comments || 'NA'}</td>
                <td className="border p-3">{row.bill_type}</td>
              </tr>
            ))}
          </tbody>
          
          {/* Table Footer Totals */}
          {data.length > 0 && (
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                <td colSpan={5} className="border p-3 text-right">Total:</td>
                <td className="border p-3 text-right">₹{totals.total_amount.toFixed(2)}</td>
                <td className="border p-3 text-right text-red-600">₹{totals.total_discount.toFixed(2)}</td>
                <td colSpan={2} className="border p-3"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}