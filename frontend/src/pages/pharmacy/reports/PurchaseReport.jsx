import React, { useState, useEffect } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

export default function PurchaseReport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [supplierId, setSupplierId] = useState('All');

  const [suppliers, setSuppliers] = useState([]);
  const [data, setData] = useState([]);
  const [totals, setTotals] = useState({});
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [duesData, setDuesData] = useState([]);

  // Fetch suppliers on mount
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
      const response = await axios.get(`http://localhost:5000/api/reports/purchase-report`, {
        params: { 
          start_date: startDate, 
          end_date: endDate,
          supplier_id: supplierId
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data.data);
      setTotals(response.data.totals);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch report.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewDues = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/supplier-dues`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDuesData(response.data);
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch supplier dues.");
    }
  };

  const handleExportDues = () => {
    if (duesData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(duesData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Supplier_Dues");
    XLSX.writeFile(wb, `Supplier_Dues.xlsx`);
  };

  return (
    <div className="p-4 bg-white min-h-screen relative">
      <h2 className="text-xl font-bold mb-4">Purchase Report</h2>

      {/* Top Filters */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-bold mb-2">Start Date</label>
          <input 
            type="date" 
            className="border border-gray-300 p-2 rounded w-48 text-sm" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
          />
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
          <label className="block text-sm font-bold mb-2">Supplier</label>
          <select 
            className="border border-gray-300 p-2 rounded w-48 text-sm" 
            value={supplierId} 
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="All">ALL</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        
        <div className="flex gap-2 ml-auto">
          <button 
            onClick={handleViewDues} 
            className="bg-[#5cb85c] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-green-600" 
          >
            Click To View DueAmounts
          </button>
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
          Purchase Report
        </div>

        <table className="w-full text-sm text-center border-collapse min-w-[1200px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-2" colSpan={3}>Supplier Bill</th>
              <th className="border p-2" colSpan={2}>GRN</th>
              <th className="border p-2" rowSpan={2}>Due From</th>
              <th className="border p-2" rowSpan={2}>Gross Amount</th>
              <th className="border p-2" rowSpan={2}>Disc Amount</th>
              <th className="border p-2" rowSpan={2}>Tax Amount</th>
              <th className="border p-2" rowSpan={2}>Net Amount</th>
              <th className="border p-2" rowSpan={2}>Credit Note Amount</th>
              <th className="border p-2" rowSpan={2}>Paid Amount</th>
              <th className="border p-2" rowSpan={2}>Due Amount</th>
              <th className="border p-2" rowSpan={2}>Due Date</th>
            </tr>
            <tr>
              <th className="border p-2 border-t-0">Invoice Date</th>
              <th className="border p-2 border-t-0">Invoice No</th>
              <th className="border p-2 border-t-0">Supplier Name</th>
              <th className="border p-2 border-t-0">GRN No</th>
              <th className="border p-2 border-t-0">GRN Date</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={14} className="p-4 text-gray-500 font-semibold">
                  No Records Found
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-2">{row.invoice_date ? new Date(row.invoice_date).toLocaleDateString('en-GB') : '-'}</td>
                <td className="border p-2">{row.invoice_no || '-'}</td>
                <td className="border p-2">{row.supplier_name || '-'}</td>
                <td className="border p-2">{row.grn_no}</td>
                <td className="border p-2">{new Date(row.grn_date).toLocaleDateString('en-GB')}</td>
                <td className="border p-2">-</td>
                <td className="border p-2 text-right">₹{parseFloat(row.gross_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-red-500">₹{parseFloat(row.disc_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(row.tax_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right font-bold text-blue-700">₹{parseFloat(row.net_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-red-500">₹{parseFloat(row.credit_note || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-green-600">₹{parseFloat(row.paid_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right font-bold text-red-600">₹{parseFloat(row.due_amount || 0).toFixed(2)}</td>
                <td className="border p-2">{row.due_date || '-'}</td>
              </tr>
            ))}
          </tbody>
          
          {/* Table Footer Totals */}
          {data.length > 0 && (
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                <td colSpan={6} className="border p-2 text-right">Total Amount:</td>
                <td className="border p-2 text-right">₹{parseFloat(totals.gross_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-red-500">₹{parseFloat(totals.disc_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(totals.tax_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-blue-700">₹{parseFloat(totals.net_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-red-500">₹0.00</td>
                <td className="border p-2 text-right text-green-600">₹{parseFloat(totals.paid_amount || 0).toFixed(2)}</td>
                <td className="border p-2 text-right text-red-600">₹{parseFloat(totals.due_amount || 0).toFixed(2)}</td>
                <td className="border p-2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Supplier Dues Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl overflow-hidden">
            
            <div className="bg-white border-b p-4 flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">Supplier Due Data</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
            </div>

            <div className="p-4">
              <div className="flex justify-end mb-4">
                <button onClick={handleExportDues} className="bg-[#d9534f] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-red-600">
                  Export To Excel
                </button>
              </div>

              <table className="w-full text-sm border-collapse">
                <thead className="bg-[#fdf3e6] text-gray-700">
                  <tr>
                    <th className="p-3 text-center border-b">Supplier Name</th>
                    <th className="p-3 text-center border-b">Due Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {duesData.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-4 text-center text-gray-500 border-b">No dues found</td>
                    </tr>
                  )}
                  {duesData.map((row, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-center">{row.supplier_name}</td>
                      <td className="p-3 text-center">{parseFloat(row.due_amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-gray-50">
                    <td className="p-3 text-center">Total:</td>
                    <td className="p-3 text-center">
                      {duesData.reduce((sum, item) => sum + parseFloat(item.due_amount || 0), 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 flex justify-end border-t">
              <button onClick={() => setIsModalOpen(false)} className="bg-[#d9534f] text-white px-4 py-2 rounded text-sm font-bold shadow-sm hover:bg-red-600">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}