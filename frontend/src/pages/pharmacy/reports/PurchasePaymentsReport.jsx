import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function PurchasePaymentsReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [supplierId, setSupplierId] = useState('All');
  const [viewType, setViewType] = useState('BRIEF');

  const [suppliers, setSuppliers] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch suppliers for dropdown
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/reports/dropdown-suppliers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuppliers(res.data);
      } catch (err) {
        console.error("Failed to load suppliers", err);
      }
    };
    fetchSuppliers();
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
      const response = await axios.get(`http://localhost:5000/api/reports/purchase-payments-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          supplier_id: supplierId,
          view_type: viewType
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
      <h2 className="text-xl font-bold mb-4">Purchase Payments Report</h2>

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
          <label className="block text-sm font-bold mb-2">Supplier</label>
          <select 
            className="border border-gray-300 p-2 rounded w-56 text-sm focus:outline-none focus:border-blue-500" 
            value={supplierId} 
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="All">ALL</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">View Type</label>
          <select 
            className="border border-gray-300 p-2 rounded w-40 text-sm focus:outline-none focus:border-blue-500" 
            value={viewType} 
            onChange={(e) => setViewType(e.target.value)}
          >
            <option value="BRIEF">BRIEF</option>
            <option value="DETAILED">DETAILED</option>
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
          Purchase Payments Report
        </div>

        <table className="w-full text-sm text-center border-collapse min-w-[1000px]">
          <thead className="bg-[#3498db] text-white">
            {viewType === 'BRIEF' ? (
              <tr>
                <th className="border p-3 font-semibold text-left">Supplier Name</th>
                <th className="border p-3 font-semibold">Total Bills</th>
                <th className="border p-3 font-semibold text-right">Total Gross Amount</th>
                <th className="border p-3 font-semibold text-right">Total Paid Amount</th>
                <th className="border p-3 font-semibold text-right">Total Due Amount</th>
              </tr>
            ) : (
              <tr>
                <th className="border p-3 font-semibold">Date</th>
                <th className="border p-3 font-semibold">GRN No</th>
                <th className="border p-3 font-semibold">Invoice No</th>
                <th className="border p-3 font-semibold text-left">Supplier Name</th>
                <th className="border p-3 font-semibold text-right">Gross Amount</th>
                <th className="border p-3 font-semibold text-right">Paid Amount</th>
                <th className="border p-3 font-semibold text-right">Due Amount</th>
              </tr>
            )}
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={viewType === 'BRIEF' ? 5 : 7} className="p-8 text-gray-400 border">
                  No data available for the selected period.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              viewType === 'BRIEF' ? (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="border p-3 text-left font-semibold">{row.supplier_name}</td>
                  <td className="border p-3 text-blue-600">{row.total_bills}</td>
                  <td className="border p-3 text-right font-bold">₹{parseFloat(row.total_gross_amount || 0).toFixed(2)}</td>
                  <td className="border p-3 text-right font-bold text-green-600">₹{parseFloat(row.total_paid_amount || 0).toFixed(2)}</td>
                  <td className="border p-3 text-right font-bold text-red-600">₹{parseFloat(row.total_due_amount || 0).toFixed(2)}</td>
                </tr>
              ) : (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="border p-3">{new Date(row.grn_date).toLocaleDateString('en-GB')}</td>
                  <td className="border p-3">{row.grn_no}</td>
                  <td className="border p-3">{row.invoice_no || '-'}</td>
                  <td className="border p-3 text-left font-semibold">{row.supplier_name}</td>
                  <td className="border p-3 text-right font-bold">₹{parseFloat(row.gross_amount || 0).toFixed(2)}</td>
                  <td className="border p-3 text-right font-bold text-green-600">₹{parseFloat(row.paid_amount || 0).toFixed(2)}</td>
                  <td className="border p-3 text-right font-bold text-red-600">₹{parseFloat(row.due_amount || 0).toFixed(2)}</td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}