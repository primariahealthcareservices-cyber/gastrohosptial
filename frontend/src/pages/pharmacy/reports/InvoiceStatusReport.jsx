import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function InvoiceStatusReport() {
  const [includeExpenses, setIncludeExpenses] = useState(false);
  const [data, setData] = useState({
    min_stock_count: 0,
    non_moving_count: 0,
    short_expiry_count: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Accordion state
  const [openSections, setOpenSections] = useState({
    nonMoving: false,
    shortExpiry: false,
    minStock: false
  });

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`http://localhost:5000/api/reports/invoice-status-report`, {
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
    fetchData();
  }, [includeExpenses]); // Re-fetch if expenses toggle changes

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="p-4 bg-white min-h-screen">
      <h2 className="text-xl font-bold mb-4">Invoice Status Report</h2>

      {/* Top Bar */}
      <div className="border border-gray-300 p-4 mb-6 bg-white shadow-sm">
        <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
          <input 
            type="checkbox" 
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            checked={includeExpenses} 
            onChange={(e) => setIncludeExpenses(e.target.checked)}
          />
          Include Expenses
        </label>
      </div>

      {error && <div className="text-red-500 mb-4 font-bold bg-red-50 p-2 border border-red-200">{error}</div>}

      {/* Accordion Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. Non-Movable & Fast Moving Stock */}
        <div className="border border-gray-300 shadow-sm rounded bg-white">
          <div 
            className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 border-b-2 border-blue-500"
            onClick={() => toggleSection('nonMoving')}
          >
            <h3 className="font-bold text-gray-800">Non - Movable & Fast Moving Stock</h3>
            <div className="flex gap-2 text-gray-400">
              <span className="text-lg font-bold">{openSections.nonMoving ? '−' : '+'}</span>
              <span className="text-sm font-bold">x</span>
            </div>
          </div>
          {openSections.nonMoving && (
            <div className="p-4 text-sm text-gray-600">
              <p>Total Non-Moving Items (Last 30 days): <span className="font-bold text-red-600">{data.non_moving_count}</span></p>
            </div>
          )}
        </div>

        {/* 2. Short Expiry Stock */}
        <div className="border border-gray-300 shadow-sm rounded bg-white">
          <div 
            className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 border-b-2 border-green-500"
            onClick={() => toggleSection('shortExpiry')}
          >
            <h3 className="font-bold text-gray-800">Short Expiry Stock</h3>
            <div className="flex gap-2 text-gray-400">
              <span className="text-lg font-bold">{openSections.shortExpiry ? '−' : '+'}</span>
              <span className="text-sm font-bold">x</span>
            </div>
          </div>
          {openSections.shortExpiry && (
            <div className="p-4 text-sm text-gray-600">
              <p>Items Expiring in 90 Days: <span className="font-bold text-orange-600">{data.short_expiry_count}</span></p>
            </div>
          )}
        </div>

        {/* 3. Minimum Stock */}
        <div className="border border-gray-300 shadow-sm rounded bg-white">
          <div 
            className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50 border-b-2 border-blue-500"
            onClick={() => toggleSection('minStock')}
          >
            <h3 className="font-bold text-gray-800">Minimum Stock</h3>
            <div className="flex gap-2 text-gray-400">
              <span className="text-lg font-bold">{openSections.minStock ? '−' : '+'}</span>
              <span className="text-sm font-bold">x</span>
            </div>
          </div>
          {openSections.minStock && (
            <div className="p-4 text-sm text-gray-600">
              <p>Items Below Minimum Threshold: <span className="font-bold text-red-600">{data.min_stock_count}</span></p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}