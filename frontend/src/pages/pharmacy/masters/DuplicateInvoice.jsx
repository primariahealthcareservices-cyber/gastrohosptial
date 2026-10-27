import { useEffect, useState } from 'react'
import { Search, Printer, Edit, X, Eye } from 'lucide-react'
import { PageHeader } from '../../../components/PageHeader'
import { duplicateInvoiceApi } from '../../../api/axios'

export default function DuplicateInvoice() {
  const [activeTab, setActiveTab] = useState('OP')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')
  const [searchWithDates, setSearchWithDates] = useState(false)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)

  // Modals state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [isEditMode, setIsEditMode] = useState(false)

  // Edit form state
  const [editDiscount, setEditDiscount] = useState(0)
  const [editPaymentMode, setEditPaymentMode] = useState('Cash')
  const [editNetAmount, setEditNetAmount] = useState(0)
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      let res
      const params = { start_date: startDate, end_date: endDate, search }

      if (activeTab === 'OP') {
        res = await duplicateInvoiceApi.getOpInvoices(params)
      } else if (activeTab === 'IP') {
        res = await duplicateInvoiceApi.getIpInvoices(params)
      } else {
        res = await duplicateInvoiceApi.getReturnsInvoices(params)
      }

      setData(res.data || res || [])
    } catch (err) {
      console.error("Fetch Error:", err)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const handleSearch = (e) => {
    e.preventDefault()
    fetchData()
  }

  const openDetail = async (row, editMode = false) => {
    setDetailOpen(true)
    setIsEditMode(editMode)
    setDetail(null)
    setDetailError('')
    setDetailLoading(true)
    
    try {
      let res
      if (activeTab === 'OP') {
        res = await duplicateInvoiceApi.getOpDetails(row.id)
      } else if (activeTab === 'IP') {
        res = await duplicateInvoiceApi.getIpDetails(row.id)
      } else {
        res = await duplicateInvoiceApi.getReturnsDetails(row.id)
      }
      
      const detailData = res.data || res || null
      
      if (detailData) {
        detailData.patient_name = detailData.patient_name || row.patient_name || 'Unknown Patient'
        detailData.mobile = detailData.mobile || row.mobile || 'N/A'
      }
      
      setDetail(detailData)
      
      if (detailData) {
        setEditDiscount(detailData.discount_amount || 0)
        setEditNetAmount(detailData.total_amount || 0)
        setEditPaymentMode('Cash')
      }
    } catch (err) {
      console.error(err)
      setDetailError('Failed to load invoice details.')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailOpen(false)
    setDetail(null)
    setIsEditMode(false)
  }

  // ---------------------------------------------------------
  // PRINT FUNCTIONALITY (Using Main Window for exact filename)
  // ---------------------------------------------------------
  const handlePrint = async (row) => {
    try {
      let res
      if (activeTab === 'OP') res = await duplicateInvoiceApi.getOpDetails(row.id)
      else if (activeTab === 'IP') res = await duplicateInvoiceApi.getIpDetails(row.id)
      else res = await duplicateInvoiceApi.getReturnsDetails(row.id)

      const dataToPrint = res.data || res
      if (!dataToPrint) return

      const patientName = dataToPrint.patient_name || row.patient_name || 'Unknown_Patient'
      const mobile = dataToPrint.mobile || row.mobile || 'N/A'
      const invoiceNo = dataToPrint.invoice_no || row.invoice_no || 'N/A'

      // Save original title
      const originalTitle = document.title
      
      // Set document title to exactly the patient name
      document.title = patientName

      // Create hidden iframe
      const iframe = document.createElement('iframe')
      iframe.style.position = 'absolute'
      iframe.style.width = '0px'
      iframe.style.height = '0px'
      iframe.style.border = 'none'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow.document

      // Write receipt into iframe
      doc.open()
      doc.write(`
        <html>
          <head>
            <title>${patientName}</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; font-size: 12px; color: #000; }
              .header { text-align: center; margin-bottom: 20px; }
              .header h2 { margin: 0 0 5px 0; font-size: 18px; }
              .header p { margin: 2px 0; font-size: 11px; }
              .divider { border-bottom: 1px solid #000; margin: 10px 0; }
              .details { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 12px; }
              .details div { line-height: 1.5; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
              th, td { border: 1px solid #000; padding: 6px; text-align: left; }
              th { background-color: #e5e5e5; font-weight: bold; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .totals { width: 300px; float: right; margin-top: 10px; }
              .totals td { border: none; padding: 4px; }
              .footer { margin-top: 40px; text-align: center; font-size: 10px; clear: both; }
              .signature { margin-top: 40px; text-align: right; margin-right: 50px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Lakshmi medical Stores</h2>
              <p>Address: Door No:13-2-2, 1st line Gunturvari thota Old club road Guntur-522001</p>
              <p>Phnumber: 9613374999, 9613384999</p>
              <h3 style="margin-top: 15px;">Sale Bill</h3>
            </div>
            
            <div class="details">
              <div>
                <p><strong>Patient Name:</strong> ${patientName}</p>
                <p><strong>Mobile:</strong> ${mobile}</p>
              </div>
              <div>
                <p><strong>Bill No:</strong> ${invoiceNo}</p>
                <p><strong>Date:</strong> ${new Date(dataToPrint.created_at || row.created_at).toLocaleDateString('en-GB')}</p>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Particular(s)</th>
                  <th>Batch No</th>
                  <th>Exp Date</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Gross(Rs)</th>
                  <th class="text-right">CGST(Rs)</th>
                  <th class="text-right">SGST(Rs)</th>
                  <th class="text-right">Amount(Rs)</th>
                </tr>
              </thead>
              <tbody>
                ${dataToPrint.items && dataToPrint.items.map(it => `
                  <tr>
                    <td>${it.medicine_name}</td>
                    <td>${it.batch_no || '-'}</td>
                    <td>${it.expiry || '-'}</td>
                    <td class="text-right">${it.qty}</td>
                    <td class="text-right">${it.amount}</td>
                    <td class="text-right">0.00</td>
                    <td class="text-right">0.00</td>
                    <td class="text-right">${it.amount}</td>
                  </tr>
                `).join('') || '<tr><td colspan="8" class="text-center">No items</td></tr>'}
              </tbody>
            </table>

            <table class="totals">
              <tr>
                <td><strong>Total Amount:</strong></td>
                <td class="text-right"><strong>₹${dataToPrint.gross_total || row.total_amount || 0}</strong></td>
              </tr>
              <tr>
                <td><strong>Discount:</strong></td>
                <td class="text-right">₹${dataToPrint.discount_amount || 0}</td>
              </tr>
              <tr>
                <td><strong>Net Paid:</strong></td>
                <td class="text-right"><strong>₹${dataToPrint.total_amount || row.total_amount || 0}</strong></td>
              </tr>
            </table>
            
            <div style="clear: both;"></div>

            <div class="footer">
              <p>Note: Fridge items once sold cannot be taken back.</p>
            </div>

            <div class="signature">
              <p>_______________________</p>
              <p>Authorized Signature</p>
            </div>
          </body>
        </html>
      `)
      doc.close()

      // Give browser 100ms to register the new title before triggering print
      setTimeout(() => {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
        
        // Restore the original page title and clean up iframe
        setTimeout(() => {
          document.title = originalTitle
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 2000) // 2 seconds is enough for the print dialog to grab the title
      }, 100)

    } catch (err) {
      console.error(err)
      alert("Failed to generate print view")
    }
  }

  const handleUpdateInvoice = async (e) => {
    e.preventDefault()
    setIsUpdating(true)
    try {
      await duplicateInvoiceApi.updateInvoice({
        invoice_id: detail.id,
        discount_amount: editDiscount,
        net_amount: editNetAmount,
        payment_mode: editPaymentMode
      })
      alert("Invoice Updated Successfully!")
      closeDetail()
      fetchData()
    } catch (err) {
      alert("Failed to update invoice")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <PageHeader title="Duplicate Invoice" />

      <div className="p-4">
        <div className="bg-white border border-gray-300 rounded-sm">
          
          {/* Header Tabs */}
          <div className="border-b border-gray-300 p-4 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-sm">IP / OP Invoice</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('OP')}
                className={`px-4 py-1 text-sm font-semibold rounded-sm border ${activeTab === 'OP' ? 'bg-[#4da3d9] text-white border-[#4da3d9]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
              >
                OP Invoice
              </button>
              <button 
                onClick={() => setActiveTab('IP')}
                className={`px-4 py-1 text-sm font-semibold rounded-sm border ${activeTab === 'IP' ? 'bg-[#4da3d9] text-white border-[#4da3d9]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
              >
                IP Invoice
              </button>
              <button 
                onClick={() => setActiveTab('RETURN')}
                className={`px-4 py-1 text-sm font-semibold rounded-sm border ${activeTab === 'RETURN' ? 'bg-[#4da3d9] text-white border-[#4da3d9]' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
              >
                Return Invoice
              </button>
            </div>
          </div>

          {/* Filters */}
          <form onSubmit={handleSearch} className="p-4">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)} 
                  className="border border-gray-300 p-1.5 text-sm rounded-sm outline-none focus:border-[#4da3d9] w-40" 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="border border-gray-300 p-1.5 text-sm rounded-sm outline-none focus:border-[#4da3d9] w-40" 
                />
              </div>
              <button type="submit" className="bg-[#4da3d9] text-white px-4 py-1.5 text-sm font-semibold rounded-sm hover:bg-[#3b8bb8]">
                Get In Detail
              </button>
            </div>

            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-700">Search With Dates</label>
                <input 
                  type="checkbox" 
                  checked={searchWithDates}
                  onChange={(e) => setSearchWithDates(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">Search:</span>
                <input 
                  type="text" 
                  placeholder="Name/InvoiceNo/Mobile" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-gray-300 p-1.5 text-sm rounded-sm outline-none focus:border-[#4da3d9] w-64" 
                />
              </div>
            </div>
          </form>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#4da3d9] text-white">
                  <th className="px-4 py-2 font-semibold border-r border-white/30">Patient Name</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30">Invoice No</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30">MobileNo</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30">Created By</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30">Created Date</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30 text-right">Total (₹)</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30">Remarks</th>
                  <th className="px-4 py-2 font-semibold text-center w-28">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="text-center py-6 text-gray-500">Loading...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-6 text-gray-500">Details not available.</td></tr>
                ) : (
                  data.map((row, idx) => (
                    <tr key={row.id || idx} className="border-b border-gray-200 hover:bg-blue-50">
                      <td className="px-4 py-2 text-blue-600 font-medium cursor-pointer hover:underline" onClick={() => openDetail(row, false)}>
                        {row.patient_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{row.invoice_no}</td>
                      <td className="px-4 py-2 text-gray-700">{row.mobile || 'N/A'}</td>
                      <td className="px-4 py-2 text-gray-700">{row.created_by_name}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {row.created_at ? new Date(row.created_at).toLocaleString('en-GB') : '-'}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-800 font-semibold">{row.total_amount}</td>
                      <td className="px-4 py-2 text-gray-700">{row.remarks || 'NA'}</td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openDetail(row, false)} className="text-blue-500 hover:text-blue-700" title="View Details">
                            <Eye size={18} />
                          </button>
                          <button onClick={() => handlePrint(row)} className="text-green-600 hover:text-green-800" title="Print Receipt"><Printer size={18} /></button>
                          <button onClick={() => openDetail(row, true)} className="text-yellow-600 hover:text-yellow-800" title="Edit Invoice"><Edit size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex justify-between items-center px-4 py-3 text-sm text-gray-600 bg-gray-50 border-t border-gray-200">
            <span>Showing 1 to {data.length} of {data.length} entries</span>
            <div className="flex gap-1">
               <button className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-400 disabled:opacity-50" disabled>&laquo;</button>
               <button className="px-3 py-1 border border-gray-300 rounded bg-[#1f2a44] text-white">1</button>
               <button className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-400 disabled:opacity-50" disabled>&raquo;</button>
            </div>
          </div>

        </div>
      </div>

      {/* Edit / View Invoice Modal */}
      {detailOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white w-full max-w-5xl rounded-sm shadow-lg mt-10">
            
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-bold text-lg text-gray-800">
                {isEditMode ? 'Edit Invoice' : 'Invoice Details'} 
              </h3>
              <button onClick={closeDetail} className="text-gray-500 hover:text-gray-800"><X size={20} /></button>
            </div>

            <div className="p-4">
              {detailLoading ? (
                <div className="text-center py-10 text-gray-500">Loading details...</div>
              ) : detailError ? (
                <div className="text-center py-10 text-red-500">{detailError}</div>
              ) : !detail ? (
                <div className="text-center py-10 text-gray-500">No details found.</div>
              ) : (
                <>
                  {/* Header Info */}
                  <div className="mb-4 flex justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Invoice Date: </span>
                      <span className="text-sm text-gray-900 font-bold">
                        {detail.created_at ? new Date(detail.created_at).toLocaleDateString('en-GB') : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-700">Patient: </span>
                      <span className="text-sm text-blue-600 font-bold">{detail.patient_name}</span>
                      <span className="text-sm text-gray-500 ml-2">({detail.mobile})</span>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-sm mb-4">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#4da3d9] text-white">
                          <th className="px-3 py-2 border-r border-white/30">ItemName</th>
                          <th className="px-3 py-2 border-r border-white/30">BatchNo</th>
                          <th className="px-3 py-2 border-r border-white/30 text-right">Qty</th>
                          <th className="px-3 py-2 border-r border-white/30 text-right">Mrp(Per Tab)</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!detail.items || detail.items.length === 0) ? (
                          <tr><td colSpan="5" className="text-center py-6 text-gray-500">No items found.</td></tr>
                        ) : (
                          detail.items.map((it, i) => (
                            <tr key={i} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-3 py-2">{it.medicine_name}</td>
                              <td className="px-3 py-2">{it.batch_no}</td>
                              <td className="px-3 py-2 text-right">{it.qty}</td>
                              <td className="px-3 py-2 text-right">{it.rate}</td>
                              <td className="px-3 py-2 text-right font-semibold">{it.amount}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Total</label>
                      <input type="text" readOnly value={detail.gross_total || 0} className="w-full border border-gray-300 p-1.5 text-sm bg-gray-50 rounded-sm font-semibold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Discount(%)</label>
                      <input 
                        type="text" 
                        value={editDiscount} 
                        onChange={(e) => setEditDiscount(e.target.value)}
                        disabled={!isEditMode} 
                        className={`w-full border border-gray-300 p-1.5 text-sm rounded-sm ${!isEditMode ? 'bg-gray-50' : 'bg-white'}`} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Discount</label>
                      <input 
                        type="text" 
                        value={editDiscount} 
                        onChange={(e) => setEditDiscount(e.target.value)}
                        disabled={!isEditMode} 
                        className={`w-full border border-gray-300 p-1.5 text-sm rounded-sm ${!isEditMode ? 'bg-gray-50' : 'bg-white'}`} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Net Paid</label>
                      <input 
                        type="text" 
                        value={editNetAmount} 
                        onChange={(e) => setEditNetAmount(e.target.value)}
                        disabled={!isEditMode} 
                        className={`w-full border border-gray-300 p-1.5 text-sm font-bold rounded-sm ${!isEditMode ? 'bg-gray-50' : 'bg-white'}`} 
                      />
                    </div>
                  </div>

                  {/* Transaction Details Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-sm mb-6">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-[#4da3d9] text-white">
                          <th className="px-3 py-2 border-r border-white/30">Transaction</th>
                          <th className="px-3 py-2 border-r border-white/30">Amount</th>
                          <th className="px-3 py-2 border-r border-white/30">Collected At</th>
                          <th className="px-3 py-2">Paymode</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-3 py-2">Payment 1</td>
                          <td className="px-3 py-2">{editNetAmount}</td>
                          <td className="px-3 py-2">
                            {detail.created_at ? new Date(detail.created_at).toLocaleString('en-GB') : '-'}
                          </td>
                          <td className="px-3 py-2">
                            <select 
                              value={editPaymentMode} 
                              onChange={(e) => setEditPaymentMode(e.target.value)}
                              disabled={!isEditMode}
                              className={`border border-gray-300 p-1 rounded-sm w-full outline-none ${!isEditMode ? 'bg-gray-50' : 'bg-white'}`}
                            >
                              <option>Cash</option>
                              <option>Card</option>
                              <option>UPI</option>
                              <option>Credit</option>
                            </select>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-2 mt-6">
                    {isEditMode ? (
                      <>
                        <button 
                          onClick={handleUpdateInvoice} 
                          disabled={isUpdating}
                          className="bg-[#4da3d9] text-white px-6 py-2 text-sm font-semibold rounded-sm hover:bg-[#3b8bb8] disabled:opacity-50"
                        >
                          {isUpdating ? 'Updating...' : 'Update Invoice'}
                        </button>
                        <button onClick={closeDetail} className="bg-red-400 text-white px-6 py-2 text-sm font-semibold rounded-sm hover:bg-red-500">Close</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => window.print()} className="bg-[#4da3d9] text-white px-6 py-2 text-sm font-semibold rounded-sm hover:bg-[#3b8bb8]">Print</button>
                        <button onClick={closeDetail} className="bg-gray-200 text-gray-700 px-6 py-2 text-sm font-semibold rounded-sm hover:bg-gray-300">Close</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}