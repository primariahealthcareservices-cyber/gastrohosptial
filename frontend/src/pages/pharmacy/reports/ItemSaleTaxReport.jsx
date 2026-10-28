import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function ItemSaleTaxReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visitType, setVisitType] = useState('ALL');

  const [salesData, setSalesData] = useState([]);
  const [returnsData, setReturnsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGetData = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/item-sale-tax-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          visit_type: visitType
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSalesData(response.data.sales);
      setReturnsData(response.data.returns);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch report.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (data, filename) => {
    if (data.length === 0) {
      alert("No data to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Pharmacy Item Sale Tax Report</h2>

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
          <label className="block text-sm font-bold mb-2">Visit Type</label>
          <select 
            className="border border-gray-300 p-2 rounded w-40 text-sm focus:outline-none focus:border-blue-500" 
            value={visitType} 
            onChange={(e) => setVisitType(e.target.value)}
          >
            <option value="ALL">ALL</option>
            <option value="OP/DIRECT">OP/DIRECT</option>
            <option value="IP">IP</option>
          </select>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleGetData} 
            className="bg-[#337ab7] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-700" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get Data'}
          </button>
          <button 
            onClick={() => handleExport(salesData, 'Sale_Items')} 
            className="bg-[#d9534f] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-red-600"
            disabled={salesData.length === 0}
          >
            Export
          </button>
          <button 
            className="bg-[#d9534f] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-red-600"
          >
            Export HSN
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Sales Table */}
      <div className="border border-gray-300 shadow-sm mb-8 overflow-x-auto">
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          Sale Items
        </div>
        <table className="w-full text-sm text-center border-collapse min-w-[1200px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-2 font-semibold">Date</th>
              <th className="border p-2 font-semibold">Invoice No</th>
              <th className="border p-2 font-semibold">HSNCode</th>
              <th className="border p-2 font-semibold text-left">Product</th>
              <th className="border p-2 font-semibold">Batch No</th>
              <th className="border p-2 font-semibold">Expiry Date</th>
              <th className="border p-2 font-semibold">Qty</th>
              <th className="border p-2 font-semibold">MRP</th>
              <th className="border p-2 font-semibold">Disc Amount</th>
              <th className="border p-2 font-semibold">Total Inc. GST</th>
              <th className="border p-2 font-semibold">GST%</th>
              <th className="border p-2 font-semibold">GST Value</th>
              <th className="border p-2 font-semibold">Product Value</th>
              <th className="border p-2 font-semibold">Purchase Rate</th>
            </tr>
          </thead>
          <tbody>
            {salesData.length === 0 && !loading && (
              <tr>
                <td colSpan={14} className="p-8 text-gray-400 border">
                  No data available for the selected period.
                </td>
              </tr>
            )}

            {salesData.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-2">{new Date(row.date).toLocaleDateString('en-GB')}</td>
                <td className="border p-2 text-blue-600">{row.invoice_no}</td>
                <td className="border p-2">{row.hsn_code || '-'}</td>
                <td className="border p-2 text-left font-semibold text-gray-800">{row.product}</td>
                <td className="border p-2">{row.batch_no}</td>
                <td className="border p-2">{row.expiry_date !== '-' ? new Date(row.expiry_date).toLocaleDateString('en-GB') : '-'}</td>
                <td className="border p-2">{row.qty}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.mrp || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-red-500">₹{parseFloat(row.disc_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right font-bold">₹{parseFloat(row.total_inc_gst || 0).toFixed(2)}</td>
                <td className="border p-2">{row.gst_percent}%</td>
                <td className="border p-2 text-right text-green-700">₹{parseFloat(row.gst_value || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.product_value || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.purchase_rate || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Returns Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          Return Sale Items
        </div>
        <table className="w-full text-sm text-center border-collapse min-w-[1200px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-2 font-semibold">Date</th>
              <th className="border p-2 font-semibold">Invoice No</th>
              <th className="border p-2 font-semibold">HSNCode</th>
              <th className="border p-2 font-semibold text-left">Product</th>
              <th className="border p-2 font-semibold">Batch No</th>
              <th className="border p-2 font-semibold">Expiry Date</th>
              <th className="border p-2 font-semibold">Qty</th>
              <th className="border p-2 font-semibold">MRP</th>
              <th className="border p-2 font-semibold">Disc Amount</th>
              <th className="border p-2 font-semibold">Total Inc. GST</th>
              <th className="border p-2 font-semibold">GST%</th>
              <th className="border p-2 font-semibold">GST Value</th>
              <th className="border p-2 font-semibold">Product Value</th>
              <th className="border p-2 font-semibold">Purchase Rate</th>
            </tr>
          </thead>
          <tbody>
            {returnsData.length === 0 && !loading && (
              <tr>
                <td colSpan={14} className="p-8 text-gray-400 border">
                  No returns available for the selected period.
                </td>
              </tr>
            )}

            {returnsData.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-2">{new Date(row.date).toLocaleDateString('en-GB')}</td>
                <td className="border p-2 text-blue-600">{row.invoice_no}</td>
                <td className="border p-2">{row.hsn_code || '-'}</td>
                <td className="border p-2 text-left font-semibold text-gray-800">{row.product}</td>
                <td className="border p-2">{row.batch_no}</td>
                <td className="border p-2">{row.expiry_date !== '-' ? new Date(row.expiry_date).toLocaleDateString('en-GB') : '-'}</td>
                <td className="border p-2">{row.qty}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.mrp || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-red-500">₹{parseFloat(row.disc_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right font-bold">₹{parseFloat(row.total_inc_gst || 0).toFixed(2)}</td>
                <td className="border p-2">{row.gst_percent}%</td>
                <td className="border p-2 text-right text-green-700">₹{parseFloat(row.gst_value || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.product_value || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.purchase_rate || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}