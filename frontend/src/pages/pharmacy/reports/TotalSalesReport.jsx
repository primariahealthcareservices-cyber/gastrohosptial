import { useState } from 'react'
import { Search, Printer, Download } from 'lucide-react'
import { PageHeader, Section } from '../../../components/PageHeader'
import { totalSalesReportApi } from '../../../api/axios'

const today = () => new Date().toISOString().slice(0, 10)

export default function TotalSalesReport() {
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [includeExpenses, setIncludeExpenses] = useState(true)
  
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [opDetails, setOpDetails] = useState([])
  const [ipDetails, setIpDetails] = useState([])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch Summary Totals
      const summaryData = await totalSalesReportApi.getSummary({
        start_date: startDate, end_date: endDate, include_expenses: includeExpenses
      })
      setSummary(summaryData)

      // Fetch OP Details
      const opData = await totalSalesReportApi.getDetails({
        start_date: startDate, end_date: endDate, sale_type: 'OP'
      })
      setOpDetails(opData)

      // Fetch IP Details
      const ipData = await totalSalesReportApi.getDetails({
        start_date: startDate, end_date: endDate, sale_type: 'IP'
      })
      setIpDetails(ipData)

    } catch (err) {
      console.error(err)
      alert('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => window.print()

  const handleExport = () => {
    if (!opDetails.length && !ipDetails.length) {
      alert('No data to export')
      return
    }

    const headers = ['Date', 'Invoice No', 'Patient Name', 'Doctor Name', 'Billed By', 'Final Amount', 'Payment Mode', 'Remarks']
    const rows = []
    
    opDetails.forEach(r => rows.push(['OP', new Date(r.created_at).toLocaleString(), r.invoice_no, r.patient_name || '', r.doctor_name || '', r.billed_by || '', r.final_amount, r.payment_mode, r.remarks || '']))
    ipDetails.forEach(r => rows.push(['IP', new Date(r.created_at).toLocaleString(), r.invoice_no, r.patient_name || '', r.doctor_name || '', r.billed_by || '', r.final_amount, r.payment_mode, r.remarks || '']))

    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `total-sales_${startDate}_to_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Shared Table Renderer for OP and IP
  const renderTable = (title, data) => {
    const totalAmt = data.reduce((sum, r) => sum + Number(r.final_amount || 0), 0)
    
    return (
      <div className="mb-8">
        <div className="bg-[#5B9BD5] text-white px-4 py-2 text-sm font-semibold flex justify-between">
          <span>{title}</span>
          <span>Total: ₹{totalAmt.toFixed(2)}</span>
        </div>
        <div className="overflow-x-auto border border-t-0 border-gray-200">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#f8f9fa] text-gray-700 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2 font-medium">S.No</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Invoice No</th>
                <th className="px-3 py-2 font-medium">Patient Name</th>
                <th className="px-3 py-2 font-medium">Doctor Name</th>
                <th className="px-3 py-2 font-medium">Billed By</th>
                <th className="px-3 py-2 font-medium text-right">Final Amount(₹)</th>
                <th className="px-3 py-2 font-medium text-right">Return Amount(₹)</th>
                <th className="px-3 py-2 font-medium text-right">Amount(₹)</th>
                <th className="px-3 py-2 font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.length === 0 ? (
                <tr><td colSpan="10" className="px-4 py-6 text-center text-gray-500">No records found.</td></tr>
              ) : (
                data.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-blue-600">{r.invoice_no}</td>
                    <td className="px-3 py-2">{r.patient_name || '—'}</td>
                    <td className="px-3 py-2">{r.doctor_name || '—'}</td>
                    <td className="px-3 py-2">{r.billed_by || '—'}</td>
                    <td className="px-3 py-2 text-right">{Number(r.final_amount).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">0.00</td>
                    <td className="px-3 py-2 text-right">{r.payment_mode}: {Number(r.final_amount).toFixed(2)}</td>
                    <td className="px-3 py-2">{r.remarks || 'NA'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen pb-10">
      <PageHeader title="Total Sales Report" />

      {/* Top Warning/Info Banner (like image) */}
      <div className="bg-[#f0ad4e] text-white px-4 py-3 mb-6 rounded-sm text-sm">
        Select Date Range To Get Total Sales Income
      </div>

      {/* Filter Bar */}
      <div className="border border-gray-200 p-4 mb-6 rounded-sm flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input type="date" className="border border-gray-300 rounded-sm px-3 py-2 text-sm" 
              value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input type="date" className="border border-gray-300 rounded-sm px-3 py-2 text-sm" 
              value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm ml-4 cursor-pointer">
            <input type="checkbox" className="w-4 h-4" checked={includeExpenses} onChange={e => setIncludeExpenses(e.target.checked)} />
            Include Expenses
          </label>
        </div>

        <div className="flex gap-2">
          <button onClick={fetchData} className="bg-[#5B9BD5] text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-blue-600">
            {loading ? 'Loading...' : 'Get In Detail'}
          </button>
          <button onClick={handlePrint} className="bg-gray-500 text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-gray-600 flex items-center gap-2">
            <Printer size={16} /> Print
          </button>
          <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded-sm text-sm font-medium hover:bg-green-700 flex items-center gap-2">
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="space-y-4 mb-8">
          <div className="text-center font-bold text-gray-700 text-lg">
            Grand Total : {summary.grand_total.toFixed(2)}
          </div>
          
          <div className="border border-gray-200 rounded-sm">
            <div className="bg-white px-4 py-2 border-b border-gray-200 font-semibold text-sm">OP Sales</div>
            <div className="p-4 grid grid-cols-4 gap-4 text-sm text-center">
              <div><span className="text-gray-500 block">Cash</span>₹{summary.op_sales.cash.toFixed(2)}</div>
              <div><span className="text-gray-500 block">Card</span>₹{summary.op_sales.card.toFixed(2)}</div>
              <div><span className="text-gray-500 block">UPI</span>₹{summary.op_sales.upi.toFixed(2)}</div>
              <div><span className="text-gray-500 block font-bold">Total</span>₹{summary.op_sales.total.toFixed(2)}</div>
            </div>
          </div>

          <div className="border border-gray-200 rounded-sm">
            <div className="bg-white px-4 py-2 border-b border-gray-200 font-semibold text-sm">IP Sales</div>
            <div className="p-4 grid grid-cols-4 gap-4 text-sm text-center">
              <div><span className="text-gray-500 block">Cash</span>₹{summary.ip_sales.cash.toFixed(2)}</div>
              <div><span className="text-gray-500 block">Card</span>₹{summary.ip_sales.card.toFixed(2)}</div>
              <div><span className="text-gray-500 block">UPI</span>₹{summary.ip_sales.upi.toFixed(2)}</div>
              <div><span className="text-gray-500 block font-bold">Total</span>₹{summary.ip_sales.total.toFixed(2)}</div>
            </div>
          </div>

          {includeExpenses && (
            <div className="border border-gray-200 rounded-sm">
              <div className="bg-white px-4 py-2 border-b border-gray-200 font-semibold text-sm">Pharmacy Expenses</div>
              <div className="p-4 text-sm text-red-500 font-medium">₹{summary.pharmacy_expenses.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}

      {/* Detailed Tables */}
      {summary && (
        <div className="mt-8">
          {renderTable('OP Sales', opDetails)}
          {renderTable('IP Sales', ipDetails)}
        </div>
      )}
    </div>
  )
}