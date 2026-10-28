import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function GrnWiseSalesReport() {
  const [grnNo, setGrnNo] = useState('Select');
  const [grnList, setGrnList] = useState([]);
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch GRN list for the dropdown
  useEffect(() => {
    const fetchGrns = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/reports/dropdown-grns`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setGrnList(res.data);
      } catch (err) {
        console.error("Failed to load GRNs", err);
      }
    };
    fetchGrns();
  }, []);

  const handleGetDetails = async () => {
    if (grnNo === 'Select') {
      alert("Please select a GRN Number");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/grn-wise-sales-report`, {
        params: { grn_no: grnNo },
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
      <h2 className="text-xl font-bold mb-4">GRN Wise Sale Report</h2>

      {/* Top Filters */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex flex-wrap gap-6 items-end">
        <div>
          <label className="block text-sm font-bold mb-2">GRN No :</label>
          <select 
            className="border border-gray-300 p-2 rounded w-64 text-sm focus:outline-none focus:border-blue-500" 
            value={grnNo} 
            onChange={(e) => setGrnNo(e.target.value)}
          >
            <option value="Select">Select</option>
            {grnList.map((g, idx) => (
              <option key={idx} value={g}>{g}</option>
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

      {/* Report Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-center border-collapse min-w-[1200px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-2 font-semibold">InvoiceNo</th>
              <th className="border p-2 font-semibold">GRN Date</th>
              <th className="border p-2 font-semibold text-left">Item Name</th>
              <th className="border p-2 font-semibold">Batch No</th>
              <th className="border p-2 font-semibold">Qty</th>
              <th className="border p-2 font-semibold">Qty Available</th>
              <th className="border p-2 font-semibold">MRP</th>
              <th className="border p-2 font-semibold">Rate</th>
              <th className="border p-2 font-semibold">Tax %</th>
              <th className="border p-2 font-semibold">Eff Rate</th>
              <th className="border p-2 font-semibold">GRN Value</th>
              <th className="border p-2 font-semibold">Qty Available value(Rate)</th>
              <th className="border p-2 font-semibold">MRP Value</th>
              <th className="border p-2 font-semibold">Rate Value</th>
              <th className="border p-2 font-semibold">EffRate Value</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={15} className="p-8 text-gray-400 border">
                  No data available. Please select a GRN.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-2 text-blue-600">{row.invoice_no}</td>
                <td className="border p-2">{new Date(row.grn_date).toLocaleDateString('en-GB')}</td>
                <td className="border p-2 text-left font-semibold text-gray-800">{row.item_name}</td>
                <td className="border p-2">{row.batch_no}</td>
                <td className="border p-2">{row.qty}</td>
                <td className="border p-2 font-bold">{row.qty_available}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.mrp || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.rate || 0).toFixed(2)}</td>
                <td className="border p-2">{row.tax_percent}%</td>
                <td className="border p-2 text-right">₹{parseFloat(row.eff_rate || 0).toFixed(2)}</td>
                <td className="border p-2 text-right font-bold">₹{parseFloat(row.grn_value || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.qty_available_value_rate || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-gray-600">₹{parseFloat(row.mrp_value || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-gray-600">₹{parseFloat(row.rate_value || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-gray-600">₹{parseFloat(row.eff_rate_value || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}