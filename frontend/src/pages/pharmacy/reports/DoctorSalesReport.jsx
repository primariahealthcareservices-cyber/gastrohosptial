import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function DoctorSalesReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [doctorId, setDoctorId] = useState('All');

  const [doctors, setDoctors] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch doctors for dropdown
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const token = localStorage.getItem('token');
        // Reusing the /dropdown-doctors endpoint we created for the Profit Report
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
      const response = await axios.get(`http://localhost:5000/api/reports/doctor-sales-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          doctor_id: doctorId
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
      <h2 className="text-xl font-bold mb-4">Doctor Sale Report</h2>

      {/* Orange Warning Banner */}
      <div className="bg-[#f0ad4e] text-white p-3 mb-6 rounded text-sm font-medium">
        Select Doctor and Date Range To Get Doctor Sales Report
      </div>

      {/* Top Filters */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-sm font-bold mb-2">Doctor</label>
          <select 
            className="border border-gray-300 p-2 rounded w-64 text-sm focus:outline-none focus:border-blue-500" 
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
        
        <div className="ml-auto">
          <button 
            onClick={handleGetData} 
            className="bg-[#5bc0de] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get Data'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Display Section (Matches the image) */}
      <div className="space-y-6">
        
        {/* OP Sales Section */}
        <div className="border border-gray-300 shadow-sm">
          <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800 text-sm">
            OP Sales
          </div>
          <div className="p-4 min-h-[60px] text-gray-700 text-sm">
            {/* Table will go here if we show details, but the screenshot only shows a summary box */}
             {data.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead className="text-gray-500 text-xs border-b">
                    <tr>
                      <th className="p-2">Doctor Name</th>
                      <th className="p-2 text-right">Total Bills</th>
                      <th className="p-2 text-right">OP Sales Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 font-semibold">{row.doctor_name}</td>
                        <td className="p-2 text-right">{row.total_bills}</td>
                        <td className="p-2 text-right font-bold text-green-600">₹{parseFloat(row.op_sales || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             ) : (
               <div className="text-gray-400 italic">Select filters and click "Get Data" to view results.</div>
             )}
          </div>
        </div>

        {/* IP Sales Section */}
        <div className="border border-gray-300 shadow-sm">
          <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800 text-sm">
            IP Sales
          </div>
          <div className="p-4 min-h-[60px] text-gray-700 text-sm">
            {data.length > 0 ? (
                <table className="w-full text-left border-collapse">
                  <thead className="text-gray-500 text-xs border-b">
                    <tr>
                      <th className="p-2">Doctor Name</th>
                      <th className="p-2 text-right">Total Bills</th>
                      <th className="p-2 text-right">IP Sales Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 font-semibold">{row.doctor_name}</td>
                        <td className="p-2 text-right">{row.total_bills}</td>
                        <td className="p-2 text-right font-bold text-green-600">₹{parseFloat(row.ip_sales || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             ) : null}
          </div>
        </div>

      </div>
    </div>
  );
}