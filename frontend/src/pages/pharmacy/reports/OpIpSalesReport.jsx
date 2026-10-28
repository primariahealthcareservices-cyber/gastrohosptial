import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function OpIpSalesReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('All');
  const [search, setSearch] = useState('');
  
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGetDetails = async () => {
    if (!startDate || !endDate) {
      alert("Please select both Start Date and End Date");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/op-ip-sales`, {
        params: { 
          start_date: startDate, 
          end_date: endDate, 
          type: type,
          search: search 
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch report. Make sure the backend is running.");
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
    XLSX.utils.book_append_sheet(wb, ws, "OP_IP_Sales");
    XLSX.writeFile(wb, `OP_IP_Sales_${startDate}_to_${endDate}.xlsx`);
  };

  const groupedData = data.reduce((acc, row) => {
    if (!acc[row.sale_id]) {
      acc[row.sale_id] = { header: row, items: [] };
    }
    acc[row.sale_id].items.push(row);
    return acc;
  }, {});

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">OP/IP Total Sales</h2>

      <div className="border p-4 mb-4 bg-gray-50 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input type="date" className="border p-2 rounded" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input type="date" className="border p-2 rounded" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select className="border p-2 rounded" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="All">All</option>
            <option value="OP">OP</option>
            <option value="IP">IP</option>
            <option value="Direct">Direct</option> {/* <-- ADDED DIRECT HERE */}
          </select>
        </div>
        <button onClick={handleGetDetails} className="bg-[#337ab7] text-white px-6 py-2 rounded hover:bg-blue-700" disabled={loading}>
          {loading ? 'Loading...' : 'Get In Detail'}
        </button>
        <button onClick={() => window.print()} className="bg-[#5bc0de] text-white px-4 py-2 rounded hover:bg-blue-400">Print</button>
        <button onClick={handleExport} className="bg-[#d9534f] text-white px-4 py-2 rounded hover:bg-red-600">Export</button>
        <button className="bg-[#5bc0de] text-white px-4 py-2 rounded hover:bg-blue-400">Pdf Generate</button>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold">{error}</div>}

      <div className="mb-4">
        <label className="block text-sm font-bold mb-1">Search By</label>
        <input 
          type="text" 
          placeholder="Name/Reg No/Item Name" 
          className="border p-2 rounded w-1/3" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGetDetails()}
        />
      </div>

      <div className="overflow-x-auto text-sm">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-[#3498db] text-white">
              <th className="border p-2">S.No</th>
              <th className="border p-2">Created At</th>
              <th className="border p-2">Name</th>
              <th className="border p-2">Invoice No</th>
              <th className="border p-2">Type</th>
              <th className="border p-2">Qty</th>
              <th className="border p-2">Mrp</th>
              <th className="border p-2">Rate</th>
              <th className="border p-2">Amount(₹)</th>
              <th className="border p-2">GST(₹)</th>
              <th className="border p-2">Margin(₹) 1</th>
              <th className="border p-2">Margin(%) 1</th>
              <th className="border p-2">Margin(₹) 2</th>
              <th className="border p-2">Margin(%) 2</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(groupedData).length === 0 && !loading && (
              <tr>
                <td colSpan={14} className="text-center p-4 text-gray-500">
                  No data found. Please select a date range and click "Get In Detail".
                </td>
              </tr>
            )}

            {Object.values(groupedData).map((group, groupIndex) => {
              const { header, items } = group;
              const totalInvoiceAmt = items.reduce((sum, item) => sum + parseFloat(item.item_amount || 0), 0);
              
              return (
                <React.Fragment key={header.sale_id}>
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <td className="border p-2 font-bold">{groupIndex + 1}</td>
                    <td className="border p-2">{new Date(header.created_at).toLocaleDateString('en-GB').replace(/\//g, '-')}</td>
                    <td className="border p-2 font-semibold">{header.patient_name || 'Walk-in'}</td>
                    <td className="border p-2">{header.invoice_no}</td>
                    <td className="border p-2 text-blue-600 font-bold">{header.sale_type} Patient</td>
                    <td colSpan={2} className="border p-2 text-right font-bold">Discount: {header.total_invoice_discount}</td>
                    <td colSpan={3} className="border p-2 text-right font-bold">{totalInvoiceAmt.toFixed(2)}</td>
                    <td colSpan={4} className="border p-2"></td>
                  </tr>
                  
                  {items.map((item, itemIndex) => (
                    <tr key={itemIndex} className="text-center border-b hover:bg-gray-50">
                      <td colSpan={5} className="border p-2 text-left pl-4 text-gray-600">{item.item_name}</td> 
                      <td className="border p-2">{item.quantity}</td>
                      <td className="border p-2">{item.mrp}</td>
                      <td className="border p-2">{item.rate}</td>
                      <td className="border p-2">{parseFloat(item.item_amount || 0).toFixed(2)}</td>
                      <td className="border p-2">{parseFloat(item.gst_amount || 0).toFixed(2)}</td>
                      <td className="border p-2 text-green-700">{parseFloat(item.margin_amount || 0).toFixed(2)}</td>
                      <td className="border p-2 text-green-700">{parseFloat(item.margin_percent || 0).toFixed(2)}</td>
                      <td className="border p-2 text-blue-700">{parseFloat(item.margin_amount || 0).toFixed(2)}</td> 
                      <td className="border p-2 text-blue-700">{parseFloat(item.margin_percent || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}