import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function ProductWiseSalesReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itemType, setItemType] = useState('All');
  const [itemId, setItemId] = useState('Select');
  
  const [itemTypes, setItemTypes] = useState([]);
  const [items, setItems] = useState([]);
  
  const [salesData, setSalesData] = useState([]);
  const [returnsData, setReturnsData] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch Dropdown Data on Mount
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const token = localStorage.getItem('token');
        const [typesRes, itemsRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/reports/dropdown-item-types`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`http://localhost:5000/api/reports/dropdown-items`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setItemTypes(typesRes.data);
        setItems(itemsRes.data);
      } catch (err) {
        console.error("Failed to load dropdowns", err);
      }
    };
    fetchDropdowns();
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
      const response = await axios.get(`http://localhost:5000/api/reports/product-wise-sales`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          item_type_id: itemType,
          item_id: itemId
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
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filename}_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Product Wise Sale Report</h2>

      {/* Top Filters Container */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex flex-wrap gap-6 items-start">
        <div>
          <label className="block text-sm font-bold mb-2">Start Date</label>
          <input 
            type="date" 
            className="border border-gray-300 p-2 rounded w-48 text-sm" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
          />
          <p className="text-xs text-red-500 mt-1">Minimum start date<br/>should be from 01-Jan-2024</p>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">End Date</label>
          <input 
            type="date" 
            className="border border-gray-300 p-2 rounded w-48 text-sm" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Item Type</label>
          <select 
            className="border border-gray-300 p-2 rounded w-48 text-sm" 
            value={itemType} 
            onChange={(e) => setItemType(e.target.value)}
          >
            <option value="All">--All--</option>
            {itemTypes.map((t, idx) => (
              <option key={idx} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">Item Master</label>
          <select 
            className="border border-gray-300 p-2 rounded w-64 text-sm" 
            value={itemId} 
            onChange={(e) => setItemId(e.target.value)}
          >
            <option value="Select">Select</option>
            {items.map((i, idx) => (
              <option key={idx} value={i}>{i}</option>
            ))}
          </select>
        </div>
        
        <div className="mt-6">
          <button 
            onClick={handleGetDetails} 
            className="bg-[#5bc0de] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" 
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get In Detail'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold">{error}</div>}

      {/* Sales Report Section */}
      <div className="border border-gray-300 shadow-sm mb-8 relative">
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          Item Wise Sale Report
        </div>
        <button 
          onClick={() => handleExport(salesData, "Item_Wise_Sale_Report")} 
          className="absolute top-2 right-2 bg-[#5cb85c] text-white px-4 py-1 rounded text-sm font-bold shadow-sm"
        >
          Export
        </button>
        
        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-center border-collapse min-w-[800px]">
            <thead className="bg-[#3498db] text-white">
              <tr>
                <th className="border p-2">HSNCode</th>
                <th className="border p-2">Item Type</th>
                <th className="border p-2">Item Name</th>
                <th className="border p-2">Quantity Sold</th>
                <th className="border p-2">Current Qty</th>
                <th className="border p-2">MRP Value</th>
                <th className="border p-2">Tax%</th>
                <th className="border p-2">Gross Value</th>
              </tr>
            </thead>
            <tbody>
              {salesData.length === 0 && !loading && (
                <tr><td colSpan={8} className="p-4 text-gray-500">No data available</td></tr>
              )}
              {salesData.map((row, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="border p-2">{row.hsn_code || '-'}</td>
                  <td className="border p-2">{row.item_type || '-'}</td>
                  <td className="border p-2 text-left font-semibold">{row.item_name}</td>
                  <td className="border p-2">{row.qty_sold}</td>
                  <td className="border p-2">{row.current_qty}</td>
                  <td className="border p-2">₹{parseFloat(row.mrp_value || 0).toFixed(2)}</td>
                  <td className="border p-2">{row.tax_percent}%</td>
                  <td className="border p-2 font-bold text-green-700">₹{parseFloat(row.gross_value || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Returns Report Section */}
      <div className="border border-gray-300 shadow-sm relative">
        <div className="bg-white border-b-2 border-blue-500 p-3 font-bold text-gray-800">
          Item Wise Return Sale Report
        </div>
        <button 
          onClick={() => handleExport(returnsData, "Item_Wise_Return_Report")} 
          className="absolute top-2 right-2 bg-[#5cb85c] text-white px-4 py-1 rounded text-sm font-bold shadow-sm"
        >
          Export
        </button>

        <div className="overflow-x-auto p-4">
          <table className="w-full text-sm text-center border-collapse min-w-[800px]">
            <thead className="bg-[#3498db] text-white">
              <tr>
                <th className="border p-2">HSNCode</th>
                <th className="border p-2">Item Type</th>
                <th className="border p-2">Item Name</th>
                <th className="border p-2">Quantity Return</th>
                <th className="border p-2">MRP Value</th>
                <th className="border p-2">Tax%</th>
                <th className="border p-2">Gross Value</th>
              </tr>
            </thead>
            <tbody>
              {returnsData.length === 0 && !loading && (
                <tr><td colSpan={7} className="p-4 text-gray-500">No data available</td></tr>
              )}
              {returnsData.map((row, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="border p-2">{row.hsn_code || '-'}</td>
                  <td className="border p-2">{row.item_type || '-'}</td>
                  <td className="border p-2 text-left font-semibold">{row.item_name}</td>
                  <td className="border p-2">{row.qty_return}</td>
                  <td className="border p-2">₹{parseFloat(row.mrp_value || 0).toFixed(2)}</td>
                  <td className="border p-2">{row.tax_percent}%</td>
                  <td className="border p-2 font-bold text-red-600">₹{parseFloat(row.gross_value || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}