import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function DoctorWiseItemSalesReport() {
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

  const handleGetDetails = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/doctor-wise-item-sales`, {
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

  const handleExport = () => {
    if (data.length === 0) {
      alert("No data to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Doctor_Wise_Item_Sales");
    XLSX.writeFile(wb, `Doctor_Wise_Item_Sales_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Doctor Wise Item Sale Report</h2>

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

      {/* Report Display */}
      <div className="border border-gray-300 shadow-sm">
        
        {/* Section Title */}
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          Item Wise Sale Report
        </div>

        {/* Table */}
        <div className="overflow-x-auto relative">
          
          {/* Export Button (Positioned top right inside the table container) */}
          {data.length > 0 && (
            <div className="absolute top-2 right-2 z-10">
              <button onClick={handleExport} className="bg-[#5cb85c] text-white px-4 py-1 rounded text-sm font-bold shadow-sm hover:bg-green-600">
                Export
              </button>
            </div>
          )}

          <table className="w-full text-sm text-center border-collapse min-w-[800px]">
            <thead className="bg-[#3498db] text-white">
              <tr>
                <th className="border p-3 font-semibold">Sno</th>
                <th className="border p-3 font-semibold text-left">Item Name</th>
                <th className="border p-3 font-semibold">Quantity Sold</th>
                <th className="border p-3 font-semibold text-left">Doctor Name</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="p-8 text-gray-400">
                    No data available for the selected period.
                  </td>
                </tr>
              )}

              {data.map((row, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="border p-3">{index + 1}</td>
                  <td className="border p-3 text-left font-semibold text-blue-700">{row.item_name}</td>
                  <td className="border p-3 text-right font-bold text-gray-800">{row.qty_sold}</td>
                  <td className="border p-3 text-left">{row.doctor_name || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}