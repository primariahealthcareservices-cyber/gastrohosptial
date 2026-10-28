import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ScheduleItemReport() {
  const [type, setType] = useState('Sale');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Dropdown Data
  const [items, setItems] = useState([]);
  const [batches, setBatches] = useState([]);
  // A static list of common schedules (Modify if you have a master table for this)
  const schedules = ["Select", "H", "H1", "X", "OTC", "None"]; 

  // Selected Filters
  const [selectedSchedule, setSelectedSchedule] = useState('Select');
  const [selectedItem, setSelectedItem] = useState('Select');
  const [selectedBatch, setSelectedBatch] = useState('Select');

  // Report Data
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch dropdown data on mount
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const token = localStorage.getItem('token');
        const [itemsRes, batchesRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/reports/dropdown-items`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`http://localhost:5000/api/reports/dropdown-batches`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setItems(itemsRes.data);
        setBatches(batchesRes.data);
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
      const response = await axios.get(`http://localhost:5000/api/reports/schedule-item-report`, {
        params: { 
          type: type,
          start_date: startDate, 
          end_date: endDate, 
          schedule_name: selectedSchedule,
          item_name: selectedItem,
          batch_no: selectedBatch
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
      <h2 className="text-xl font-bold mb-4">Schedule/Item Report</h2>

      {/* Filter Section */}
      <div className="border p-4 mb-4 bg-gray-50 flex flex-col gap-4">
        
        {/* Row 1: Type and Dates */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select className="border p-2 rounded w-48" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="Sale">Sale</option>
              <option value="Purchase">Purchase</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input type="date" className="border p-2 rounded" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input type="date" className="border p-2 rounded" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Row 2: Dropdowns */}
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Schedule Name</label>
            <select className="border p-2 rounded w-48" value={selectedSchedule} onChange={(e) => setSelectedSchedule(e.target.value)}>
              {schedules.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          <div className="flex items-center pb-3 font-bold text-gray-500">(Or)</div>

          <div>
            <label className="block text-sm font-medium mb-1">Item Name</label>
            <select className="border p-2 rounded w-64" value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
              <option value="Select">Select</option>
              {items.map((item, idx) => <option key={idx} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="flex items-center pb-3 font-bold text-gray-500">(Or)</div>

          <div>
            <label className="block text-sm font-medium mb-1">Batch Number</label>
            <select className="border p-2 rounded w-48" value={selectedBatch} onChange={(e) => setSelectedBatch(e.target.value)}>
              <option value="Select">Select</option>
              {batches.map((batch, idx) => <option key={idx} value={batch}>{batch}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-2">
          <button onClick={handleGetDetails} className="bg-[#5bc0de] text-white px-6 py-2 rounded hover:bg-blue-400" disabled={loading}>
            {loading ? 'Loading...' : 'Get In Detail'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold">{error}</div>}

      {/* Table Section */}
      <div className="overflow-x-auto text-sm">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-[#3498db] text-white">
              <th className="border p-2 text-left">S.No</th>
              <th className="border p-2 text-left">Date</th>
              <th className="border p-2 text-left">Invoice/GRN No</th>
              <th className="border p-2 text-left">{type === 'Sale' ? 'Patient Name' : 'Supplier Name'}</th>
              <th className="border p-2 text-left">Item Name</th>
              <th className="border p-2 text-left">Batch No</th>
              <th className="border p-2 text-center">Qty</th>
              <th className="border p-2 text-right">Mrp</th>
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">Amount(₹)</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="text-center p-6 text-gray-500">
                  No records found.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-2">{index + 1}</td>
                <td className="border p-2">{new Date(row.date).toLocaleDateString('en-GB')}</td>
                <td className="border p-2">{row.invoice_no}</td>
                <td className="border p-2">{row.patient_name || 'N/A'}</td>
                <td className="border p-2 font-semibold">{row.item_name}</td>
                <td className="border p-2">{row.batch_no || 'N/A'}</td>
                <td className="border p-2 text-center">{row.qty}</td>
                <td className="border p-2 text-right">{parseFloat(row.mrp || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">{parseFloat(row.rate || 0).toFixed(2)}</td>
                <td className="border p-2 text-right font-bold text-green-700">{parseFloat(row.total_amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}