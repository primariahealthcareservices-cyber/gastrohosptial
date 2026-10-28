import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function OtIndentsReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [raisedFor, setRaisedFor] = useState('Select');
  const [providedTo, setProvidedTo] = useState('All');

  const [doctors, setDoctors] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch doctors for the "Provided To" dropdown
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
      const response = await axios.get(`http://localhost:5000/api/reports/ot-indents-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          raised_for: raisedFor,
          provided_to: providedTo
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
      <h2 className="text-xl font-bold mb-4">OT Indents Report</h2>

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
          <label className="block text-sm font-bold mb-2">Indent Raised For</label>
          <select 
            className="border border-gray-300 p-2 rounded w-48 text-sm focus:outline-none focus:border-blue-500" 
            value={raisedFor} 
            onChange={(e) => setRaisedFor(e.target.value)}
          >
            <option value="Select">--Select--</option>
            <option value="OT 1">OT 1</option>
            <option value="OT 2">OT 2</option>
            <option value="Emergency">Emergency</option>
            <option value="Ward">Ward</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Provided To</label>
          <select 
            className="border border-gray-300 p-2 rounded w-48 text-sm focus:outline-none focus:border-blue-500" 
            value={providedTo} 
            onChange={(e) => setProvidedTo(e.target.value)}
          >
            <option value="All">All</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <button 
            onClick={handleGetData} 
            className="bg-[#5bc0de] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get In Detail'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Report Table */}
      <div className="border border-gray-300 shadow-sm">
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          OT Indents Report
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-center border-collapse min-w-[800px]">
            <thead className="bg-[#f8f9fa] text-gray-700 border-b">
              <tr>
                <th className="border p-3 font-bold">Indent Date</th>
                <th className="border p-3 font-bold">Indent No</th>
                <th className="border p-3 font-bold">Raised For</th>
                <th className="border p-3 font-bold">Provided To</th>
                <th className="border p-3 font-bold">Status</th>
                <th className="border p-3 font-bold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-gray-400 border">
                    No data available for the selected period.
                  </td>
                </tr>
              )}

              {data.map((row, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="border p-3">{new Date(row.indent_date).toLocaleDateString('en-GB')}</td>
                  <td className="border p-3 font-semibold text-blue-700">{row.indent_no}</td>
                  <td className="border p-3">{row.raised_for || '-'}</td>
                  <td className="border p-3">{row.provided_to_name || '-'}</td>
                  <td className="border p-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="border p-3 text-left">{row.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}