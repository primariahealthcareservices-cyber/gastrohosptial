import { useState, useEffect, useRef } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { insuranceDueCollectionApi } from '../../../api/axios'

export default function InsuranceDueCollection() {
  // Get today's date in YYYY-MM-DD for default values
  const today = new Date().toISOString().split('T')[0]

  const [filters, setFilters] = useState({
    start_date: today,
    end_date: today,
    insurance_name: 'Select'
  })

  const [insurances, setInsurances] = useState([])
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  const printRef = useRef()

  // Fetch insurance dropdown list on component mount
  useEffect(() => {
    const fetchInsurances = async () => {
      try {
        const res = await insuranceDueCollectionApi.getInsuranceCompanies()
        setInsurances(res.data || [])
      } catch (error) {
        console.error("Failed to load insurances", error)
      }
    }
    fetchInsurances()
  }, [])

  const handleGetData = async () => {
    if (filters.insurance_name === 'Select') {
      alert("Please select an Insurance Name first.");
      return;
    }

    setLoading(true)
    setHasSearched(true)
    try {
      const res = await insuranceDueCollectionApi.getReport(filters)
      setData(res.data || [])
    } catch (error) {
      console.error("Error fetching data:", error)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    if (data.length === 0) return;
    
    const printContent = printRef.current.innerHTML
    const printWindow = window.open('', '', 'height=800,width=800')
    
    printWindow.document.write('<html><head><title>Insurance Due Collection Report</title>')
    printWindow.document.write(`
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
        .header { text-align: center; margin-bottom: 20px; }
        h2 { font-size: 20px; font-weight: bold; margin: 0; }
        p { font-size: 14px; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #000; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .footer { position: fixed; bottom: 0; right: 0; font-size: 10px; }
      </style>
    `)
    printWindow.document.write('</head><body>')
    
    // Add filters to printout
    printWindow.document.write(`
      <div class="header">
        <h2>Insurance Due Collection Report</h2>
        <p><strong>Date Range:</strong> ${filters.start_date} to ${filters.end_date}</p>
        <p><strong>Insurance:</strong> ${filters.insurance_name}</p>
      </div>
    `)
    
    printWindow.document.write(printContent)
    printWindow.document.write('<div class="footer">Page 1/1</div>')
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
      <PageHeader title="Insurance Due Collection" subtitle="Manage insurance due collections" />
      
      {/* Filter Section */}
      <div className="bg-white p-4 border border-gray-300 mt-4 mb-6 rounded-sm shadow-sm">
        <div className="flex flex-wrap items-end gap-6">
          <div className="flex flex-col">
            <label className="text-sm font-bold mb-2 text-gray-800">Start Date</label>
            <input 
              type="date" 
              value={filters.start_date}
              onChange={(e) => setFilters({...filters, start_date: e.target.value})}
              className="border border-gray-300 p-2 rounded-sm text-sm w-48 outline-none focus:border-blue-500"
            />
          </div>
          
          <div className="flex flex-col">
            <label className="text-sm font-bold mb-2 text-gray-800">End Date</label>
            <input 
              type="date" 
              value={filters.end_date}
              onChange={(e) => setFilters({...filters, end_date: e.target.value})}
              className="border border-gray-300 p-2 rounded-sm text-sm w-48 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-bold mb-2 text-gray-800">Insurance Name</label>
            <select 
              value={filters.insurance_name}
              onChange={(e) => setFilters({...filters, insurance_name: e.target.value})}
              className="border border-gray-300 p-2 rounded-sm text-sm w-64 outline-none focus:border-blue-500"
            >
              <option value="Select">Select</option>
              {insurances.map((ins, idx) => (
                <option key={idx} value={ins}>{ins}</option>
              ))}
              <option value="--ALL--">--ALL--</option>
            </select>
          </div>

          <div className="flex gap-2 ml-2">
            <button 
              onClick={handleGetData}
              disabled={loading}
              className="bg-[#5ba2d6] hover:bg-blue-600 text-white px-8 py-2 rounded-sm text-sm font-medium transition-colors"
            >
              {loading ? 'Loading...' : 'Get Data'}
            </button>
            {hasSearched && data.length > 0 && (
              <button 
                onClick={handlePrint}
                className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-2 rounded-sm text-sm font-medium transition-colors"
              >
                Print
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Screen Table View */}
      {hasSearched && (
        <div className="bg-white border border-gray-300 rounded-sm p-4 shadow-sm">
          <h3 className="text-center font-bold text-lg mb-4 text-gray-800">
            Insurance Due Details
          </h3>
          
          {data.length === 0 ? (
            <div className="text-center py-10 text-red-500 font-medium bg-gray-50 border border-dashed border-gray-300 rounded-sm">
              No Dues Found for the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-[#5ba2d6] text-white">
                  <tr>
                    <th className="py-3 px-3 font-bold border border-gray-400">S.No</th>
                    <th className="py-3 px-3 font-bold border border-gray-400">Invoice No</th>
                    <th className="py-3 px-3 font-bold border border-gray-400">Date</th>
                    <th className="py-3 px-3 font-bold border border-gray-400">Patient Reg No</th>
                    <th className="py-3 px-3 font-bold border border-gray-400">Patient Name</th>
                    <th className="py-3 px-3 font-bold border border-gray-400">Insurance Name</th>
                    <th className="py-3 px-3 font-bold border border-gray-400 text-right">Claim Amount (₹)</th>
                    <th className="py-3 px-3 font-bold border border-gray-400 text-right">Due Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50">
                      <td className="py-2 px-3 border border-gray-300">{idx + 1}</td>
                      <td className="py-2 px-3 border border-gray-300 font-medium text-blue-600">{row.invoice_no}</td>
                      <td className="py-2 px-3 border border-gray-300">{row.date}</td>
                      <td className="py-2 px-3 border border-gray-300">{row.reg_no}</td>
                      <td className="py-2 px-3 border border-gray-300">{row.patient_name}</td>
                      <td className="py-2 px-3 border border-gray-300">{row.insurance_name}</td>
                      <td className="py-2 px-3 border border-gray-300 text-right">{row.claim_amount.toFixed(2)}</td>
                      <td className="py-2 px-3 border border-gray-300 text-right font-bold text-red-600">{row.due_amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan="6" className="py-3 px-3 text-right border border-gray-300">Total:</td>
                    <td className="py-3 px-3 text-right border border-gray-300">
                      {data.reduce((sum, row) => sum + row.claim_amount, 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right border border-gray-300 text-red-600">
                      {data.reduce((sum, row) => sum + row.due_amount, 0).toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Hidden Print Section */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Invoice No</th>
                <th>Date</th>
                <th>Patient Reg No</th>
                <th>Patient Name</th>
                <th>Insurance Name</th>
                <th>Claim Amount</th>
                <th>Due Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{row.invoice_no}</td>
                  <td>{row.date}</td>
                  <td>{row.reg_no}</td>
                  <td>{row.patient_name}</td>
                  <td>{row.insurance_name}</td>
                  <td style={{ textAlign: 'right' }}>{row.claim_amount.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{row.due_amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="6" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {data.reduce((sum, row) => sum + row.claim_amount, 0).toFixed(2)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {data.reduce((sum, row) => sum + row.due_amount, 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  )
}