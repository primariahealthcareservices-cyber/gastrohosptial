import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function PatientWiseSaleReport() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch search suggestions as user types
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length > 1) {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(`http://localhost:5000/api/reports/search-patients`, {
            params: { q: searchQuery },
            headers: { Authorization: `Bearer ${token}` }
          });
          setSuggestions(res.data);
          setShowDropdown(true);
        } catch (err) {
          console.error("Search failed", err);
        }
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 300); // Debounce for 300ms

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchQuery(`${patient.patient_uid} | ${patient.name}`);
    setShowDropdown(false);
  };

  const handleGetDetails = async () => {
    if (!selectedPatient) {
      alert("Please select a patient first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`http://localhost:5000/api/reports/patient-wise-sale-report`, {
        params: { patient_id: selectedPatient.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data.data);
      setSummary(response.data.summary);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to fetch report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Patient Wise Sale Report</h2>

      {/* Top Search Section */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm flex flex-wrap gap-6 items-start">
        
        {/* Custom Autocomplete Search */}
        <div className="relative w-full max-w-md" ref={dropdownRef}>
          <label className="block text-sm font-bold mb-2">Patient Reg No :</label>
          <div className="flex">
            <input 
              type="text" 
              className="border border-gray-300 p-2 rounded-l w-full text-sm focus:outline-none focus:border-blue-500" 
              placeholder="Search for a Patient"
              value={searchQuery} 
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedPatient) setSelectedPatient(null); // Reset selection if typing again
              }}
            />
          </div>

          {/* Suggestions Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-300 mt-1 rounded shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((p) => (
                <li 
                  key={p.id} 
                  className="p-2 hover:bg-blue-100 cursor-pointer text-sm border-b last:border-b-0"
                  onClick={() => handleSelectPatient(p)}
                >
                  <span className="font-semibold">{p.patient_uid}</span> | {p.name} <br/>
                  <span className="text-gray-500 text-xs">{p.phone}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="mt-6">
          <button 
            onClick={handleGetDetails} 
            className="bg-[#5bc0de] text-white px-6 py-2 rounded text-sm font-bold shadow-sm hover:bg-blue-400" 
            disabled={loading || !selectedPatient}
          >
            {loading ? 'Loading...' : 'Get In Detail'}
          </button>
        </div>

        {/* Summary Panel (Only shows if data exists) */}
        {summary && (
          <div className="ml-auto text-sm border p-3 rounded bg-gray-50 min-w-[250px]">
            <div className="flex justify-between py-1 border-b"><span className="font-semibold text-gray-700">Invoice Total :</span> <span>₹{summary.invoice_total.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b"><span className="font-semibold text-gray-700">Discount Amount :</span> <span>₹{summary.discount_total.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b"><span className="font-semibold text-gray-700">Bill Total :</span> <span>₹{summary.bill_total.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b"><span className="font-semibold text-gray-700">Paid Total :</span> <span className="text-green-600">₹{summary.paid_total.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b"><span className="font-semibold text-gray-700">Due Total :</span> <span className="text-red-500">₹{summary.due_total.toFixed(2)}</span></div>
            <div className="flex justify-between py-1 border-b"><span className="font-semibold text-gray-700">Due Received Total :</span> <span>₹{summary.due_rec_total.toFixed(2)}</span></div>
            <div className="flex justify-between py-1"><span className="font-semibold text-gray-700">Return Total :</span> <span className="text-red-500">₹{summary.return_total.toFixed(2)}</span></div>
          </div>
        )}
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Detailed Table */}
      <div className="border border-gray-300 shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-center border-collapse min-w-[1000px]">
          <thead className="bg-[#3498db] text-white">
            <tr>
              <th className="border p-3 font-semibold">Patient RegNo</th>
              <th className="border p-3 font-semibold">Name</th>
              <th className="border p-3 font-semibold">Phone</th>
              <th className="border p-3 font-semibold">Invoice No</th>
              <th className="border p-3 font-semibold">Service</th>
              <th className="border p-3 font-semibold">InvoiceAmt</th>
              <th className="border p-3 font-semibold">DiscountAmt</th>
              <th className="border p-3 font-semibold">BillAmt</th>
              <th className="border p-3 font-semibold">PaidAmt</th>
              <th className="border p-3 font-semibold">DueAmt</th>
              <th className="border p-3 font-semibold">DueRec Amt</th>
              <th className="border p-3 font-semibold">Return Amt</th>
              <th className="border p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && !loading && (
              <tr>
                <td colSpan={13} className="p-6 text-gray-500 border">
                  No data available for the selected patient.
                </td>
              </tr>
            )}

            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="border p-3">{row.patient_reg_no}</td>
                <td className="border p-3 font-semibold">{row.patient_name}</td>
                <td className="border p-3">{row.phone || '-'}</td>
                <td className="border p-3 text-blue-600">{row.invoice_no}</td>
                <td className="border p-3">{row.service}</td>
                <td className="border p-3 text-right">{parseFloat(row.bill_amt || 0).toFixed(2)}</td>
                <td className="border p-3 text-right text-red-500">{parseFloat(row.discount_amt || 0).toFixed(2)}</td>
                <td className="border p-3 text-right font-bold">{parseFloat(row.bill_amt || 0).toFixed(2)}</td>
                <td className="border p-3 text-right text-green-600">{parseFloat(row.paid_amount || 0).toFixed(2)}</td>
                <td className="border p-3 text-right text-red-600">{parseFloat(row.due_amount || 0).toFixed(2)}</td>
                <td className="border p-3 text-right">0.00</td>
                <td className="border p-3 text-right text-red-500">
                   {row.status === 'Returned' ? parseFloat(row.bill_amt).toFixed(2) : '0.00'}
                </td>
                <td className="border p-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'Submitted' ? 'bg-green-100 text-green-700' : 'bg-gray-200'}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}