import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function EmployeeSalesReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [userId, setUserId] = useState('Select');
  const [type, setType] = useState('Daily');

  const [users, setUsers] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch users on mount
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

  const handleGetData = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/employee-sales`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          user_id: userId === 'Select' ? 'All' : userId,
          type: type
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setReportData(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      
      {/* Orange Warning Banner */}
      <div className="bg-[#f0ad4e] text-white p-3 mb-4 rounded text-sm font-medium">
        Select User and Date Range To Get Sales Data
      </div>

      {/* Top Filters Container */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm">
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-sm font-bold mb-2">User</label>
            <select 
              className="border border-gray-300 p-2 rounded w-56 text-sm focus:outline-none focus:border-blue-500" 
              value={userId} 
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="Select">Select</option>
              <option value="All">All Users</option>
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
          <div>
            <label className="block text-sm font-bold mb-2">Type</label>
            <select 
              className="border border-gray-300 p-2 rounded w-40 text-sm focus:outline-none focus:border-blue-500" 
              value={type} 
              onChange={(e) => setType(e.target.value)}
            >
              <option value="Daily">Daily</option>
              <option value="Monthly">Monthly</option>
              <option value="Yearly">Yearly</option>
            </select>
          </div>
          
          <div className="ml-auto">
            <button 
              onClick={handleGetData} 
              className="bg-[#5bc0de] hover:bg-[#31b0d5] text-white px-6 py-2 rounded text-sm font-bold shadow-sm transition-colors" 
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Get Data'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Display Sections */}
      <div className="space-y-6">
        
        {/* Grand Total Header */}
        <div className="text-center font-bold text-lg">
          Grand Total : {reportData ? reportData.grand_total.toFixed(2) : ''}
        </div>

        {/* OP Sales Section */}
        <div className="border border-gray-300 shadow-sm">
          <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800 text-sm">
            OP Sales
          </div>
          <div className="p-4 min-h-[60px] text-gray-700 text-sm">
            {reportData && reportData.op_sales > 0 ? (
               <span className="font-bold text-green-600">₹ {reportData.op_sales.toFixed(2)}</span>
            ) : null}
          </div>
        </div>

        {/* IP Sales Section */}
        <div className="border border-gray-300 shadow-sm">
          <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800 text-sm">
            IP Sales
          </div>
          <div className="p-4 min-h-[60px] text-gray-700 text-sm">
            {reportData && reportData.ip_sales > 0 ? (
               <span className="font-bold text-green-600">₹ {reportData.ip_sales.toFixed(2)}</span>
            ) : null}
          </div>
        </div>

        {/* Pharmacy Expenses Section */}
        <div className="border border-gray-300 shadow-sm">
          <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800 text-sm">
            Pharmacy Expenses
          </div>
          <div className="p-4 min-h-[60px] text-gray-700 text-sm">
            {reportData && reportData.pharmacy_expenses > 0 ? (
               <span className="font-bold text-red-600">₹ {reportData.pharmacy_expenses.toFixed(2)}</span>
            ) : null}
          </div>
        </div>

        {/* Grand Total Footer */}
        <div className="text-center font-bold text-lg mt-8">
          Grand Total : {reportData ? reportData.grand_total.toFixed(2) : ''}
        </div>

      </div>
    </div>
  );
}