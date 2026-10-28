import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function GrnWisePurchaseReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [grnNo, setGrnNo] = useState('ALL');
  const [type, setType] = useState('Day');

  const [grns, setGrns] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch GRN numbers for dropdown
  useEffect(() => {
    const fetchGrns = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/reports/dropdown-grns`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGrns(res.data);
      } catch (err) {
        console.error("Failed to load GRNs", err);
      }
    };
    fetchGrns();
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
      const response = await axios.get(`http://localhost:5000/api/reports/grn-wise-purchase-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          grn_no: grnNo,
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
      <h2 className="text-xl font-bold mb-4">GRN Wise Purchase Report</h2>

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
          <label className="block text-sm font-bold mb-2">GRN No</label>
          <select 
            className="border border-gray-300 p-2 rounded w-56 text-sm focus:outline-none focus:border-blue-500" 
            value={grnNo} 
            onChange={(e) => setGrnNo(e.target.value)}
          >
            <option value="ALL">ALL</option>
            {grns.map((g, idx) => (
              <option key={idx} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Type</label>
          <select 
            className="border border-gray-300 p-2 rounded w-32 text-sm focus:outline-none focus:border-blue-500" 
            value={type} 
            onChange={(e) => setType(e.target.value)}
          >
            <option value="Day">Day</option>
            <option value="Month">Month</option>
            <option value="Year">Year</option>
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
          Pharmacy GRN Purchase Report
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-center border-collapse min-w-[800px]">
            <thead className="bg-[#f8f9fa] text-gray-700 border-b">
              <tr>
                <th className="border p-3 font-bold">Date / Period</th>
                <th className="border p-3 font-bold">GRN No</th>
                <th className="border p-3 font-bold">Supplier Name</th>
                <th className="border p-3 font-bold">Invoice No</th>
                <th className="border p-3 font-bold">Total Purchase Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="p-8 text-gray-400 border">
                    No data available for the selected period.
                  </td>
                </tr>
              )}

              {data.map((row, index) => {
                let displayDate = row.report_date;
                if (type === 'Day') {
                  displayDate = new Date(row.report_date).toLocaleDateString('en-GB');
                }

                return (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="border p-3 font-semibold">{displayDate}</td>
                    <td className="border p-3 text-blue-600 font-bold">{row.grn_no}</td>
                    <td className="border p-3 text-left">{row.supplier_name || '-'}</td>
                    <td className="border p-3">{row.invoice_no || '-'}</td>
                    <td className="border p-3 text-right font-bold text-green-700">₹{parseFloat(row.total_purchase_amount || 0).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}