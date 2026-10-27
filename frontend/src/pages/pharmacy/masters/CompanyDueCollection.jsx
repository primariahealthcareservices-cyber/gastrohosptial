import { useState, useRef } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { companyDueCollectionApi } from '../../../api/axios' // Adjust path if needed

export default function CompanyDueCollection() {
  const [filters, setFilters] = useState({
    start_date: '2024-01-22',
    end_date: '2026-10-22',
    company_name: 'All'
  })
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  const printRef = useRef()

  const handleGetData = async () => {
    setLoading(true)
    setHasSearched(true)
    try {
      const res = await companyDueCollectionApi.getReport(filters)
      setData(res.data || [])
    } catch (error) {
      console.error("Error fetching data:", error)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (!hasSearched) return;
    
    const printContent = printRef.current.innerHTML
    const originalContent = document.body.innerHTML
    
    // Create a temporary print window
    const printWindow = window.open('', '', 'height=800,width=800')
    printWindow.document.write('<html><head><title>Company Due Collection Report</title>')
    printWindow.document.write('<style>')
    printWindow.document.write(`
      body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
      h2 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
      th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
      th { font-weight: bold; border-bottom: 2px solid #000; }
      .text-center { text-align: center; }
      .footer { position: fixed; bottom: 0; right: 0; font-size: 12px; }
    `)
    printWindow.document.write('</style></head><body>')
    
    // Add date/time to print (matching your screenshot)
    const now = new Date();
    printWindow.document.write(`<div style="font-size: 10px; margin-bottom: 10px;">${now.toLocaleDateString('en-GB')}, ${now.toLocaleTimeString('en-US')}</div>`)
    
    printWindow.document.write(printContent)
    printWindow.document.write('<div class="footer">1/1</div>')
    printWindow.document.write('</body></html>')
    
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <PageHeader title="Company Due Collection" subtitle="Manage company due collections" />
      
      {/* Filter Section */}
      <div className="bg-white p-4 border border-gray-300 mt-4 mb-6 rounded-sm">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Start Date</label>
            <input 
              type="date" 
              value={filters.start_date}
              onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              className="border border-gray-300 p-2 rounded-sm text-sm w-48 outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">End Date</label>
            <input 
              type="date" 
              value={filters.end_date}
              onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              className="border border-gray-300 p-2 rounded-sm text-sm w-48 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-semibold mb-1 text-gray-700">Company Name</label>
            <select 
              value={filters.company_name}
              onChange={(e) => setFilters({...filters, company_name: e.target.value})}
              className="border border-gray-300 p-2 rounded-sm text-sm w-48 outline-none focus:border-blue-500"
            >
              <option value="All">All</option>
              {/* Add company options here dynamically if needed */}
            </select>
          </div>

          <div className="flex gap-2 ml-2">
            <button 
              onClick={handleGetData}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-sm text-sm font-medium transition-colors"
            >
              {loading ? 'Loading...' : 'Get Data'}
            </button>
            <button 
              onClick={handlePrint}
              disabled={!hasSearched || data.length === 0}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-sm text-sm font-medium transition-colors disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Screen View (Table) */}
      <div className="bg-white border border-gray-300 rounded-sm p-4">
        <h3 className="text-center font-bold text-lg mb-4 text-gray-800">All Due Collection Report</h3>
        
        {!hasSearched || data.length === 0 ? (
          <div className="text-center py-10 text-gray-500 font-medium">
            No Records Found
          </div>
        ) : (
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="py-2 px-2 font-bold">Patient RegNo</th>
                <th className="py-2 px-2 font-bold">Patient Name</th>
                <th className="py-2 px-2 font-bold">Phone</th>
                <th className="py-2 px-2 font-bold">Total (Rs)</th>
                <th className="py-2 px-2 font-bold">Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="py-2 px-2">{row.patient_regno || row.regNo}</td>
                  <td className="py-2 px-2">{row.patient_name || row.patientName}</td>
                  <td className="py-2 px-2">{row.phone}</td>
                  <td className="py-2 px-2">{row.total || row.total_amount}</td>
                  <td className="py-2 px-2">{row.payment_status || row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Hidden Print Layout (This gets rendered when you click Print) */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <h2>All Companies Due Collection Report</h2>
          <table>
            <thead>
              <tr>
                <th>Patient RegNo</th>
                <th>Patient Name</th>
                <th>Phone</th>
                <th>Total (Rs)</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? data.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.patient_regno || row.regNo}</td>
                  <td>{row.patient_name || row.patientName}</td>
                  <td>{row.phone}</td>
                  <td>{row.total || row.total_amount}</td>
                  <td>{row.payment_status || row.status}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="text-center">No Records Found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}