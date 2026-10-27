import { useState, useRef } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { opIpDueCollectionApi } from '../../../api/axios'

export default function OpIpDueCollection() {
  // State for the main search
  const [searchQuery, setSearchQuery] = useState('')
  
  // State for Patient Selection Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [patientType, setPatientType] = useState('INPATIENT')
  const [patientList, setPatientList] = useState([])
  const [modalSearch, setModalSearch] = useState('')
  const [isFetchingList, setIsFetchingList] = useState(false)

  // State for Main Details View
  const [patientData, setPatientData] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // State for Collect Payment Modal
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [paymentForm, setPaymentForm] = useState({
    discount_percentage: 0, discount_amount: 0, net_amount: 0, 
    payment_mode: 'Cash', paid_amount: 0, remaining_due: 0, remarks: 'NA'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const printRef = useRef()

  // --- Handlers ---

  const handleOpenModal = async () => {
    setIsModalOpen(true)
    fetchPatientList()
  }

  const fetchPatientList = async () => {
    setIsFetchingList(true)
    try {
      const res = await opIpDueCollectionApi.getPatients({ type: patientType, search: modalSearch })
      setPatientList(res.data || [])
    } catch (error) {
      console.error(error)
      setPatientList([])
    } finally {
      setIsFetchingList(false)
    }
  }

  const handleSelectPatient = async (regNo) => {
    setIsModalOpen(false)
    setLoadingDetails(true)
    setSearchQuery(regNo)
    try {
      const res = await opIpDueCollectionApi.getPatientDetails(regNo)
      setPatientData(res)
    } catch (error) {
      console.error(error)
      alert(error.response?.data?.error || "Error fetching details")
      setPatientData(null)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleOpenCollect = (invoice) => {
    setSelectedInvoice(invoice)
    setPaymentForm({
      discount_percentage: 0,
      discount_amount: 0,
      net_amount: invoice.due,
      payment_mode: 'Cash',
      paid_amount: 0,
      remaining_due: invoice.due,
      remarks: 'NA'
    })
    setIsCollectModalOpen(true)
  }

  const handlePaymentChange = (e) => {
    const { name, value } = e.target
    let val = parseFloat(value) || 0
    let updatedForm = { ...paymentForm, [name]: value }

    // Auto-calculate logic
    if (name === 'discount_percentage') {
      updatedForm.discount_amount = (selectedInvoice.due * val) / 100
      updatedForm.net_amount = selectedInvoice.due - updatedForm.discount_amount
    } else if (name === 'discount_amount') {
      updatedForm.net_amount = selectedInvoice.due - val
    } else if (name === 'paid_amount' || name === 'net_amount') {
        // handled below
    }
    
    // Ensure net amount doesn't go below 0 due to manual discount entry
    if (updatedForm.net_amount < 0) updatedForm.net_amount = 0;

    updatedForm.remaining_due = updatedForm.net_amount - (parseFloat(updatedForm.paid_amount) || 0)
    setPaymentForm(updatedForm)
  }

  const handleCollectSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await opIpDueCollectionApi.collectPayment({
        sale_id: selectedInvoice.id, // Send the actual ID for DB update
        paid_amount: paymentForm.paid_amount,
        discount_amount: paymentForm.discount_amount,
        payment_mode: paymentForm.payment_mode,
        remarks: paymentForm.remarks
      })
      alert("Payment Collected Successfully!")
      setIsCollectModalOpen(false)
      // Refresh details to show updated dues
      handleSelectPatient(patientData.patient.reg_no)
    } catch (error) {
      alert(error.response?.data?.error || "Failed to collect payment")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePrint = () => {
    if (!patientData) return;
    const printContent = printRef.current.innerHTML
    const printWindow = window.open('', '', 'height=800,width=800')
    printWindow.document.write('<html><head><title>Due Collection Receipt</title>')
    printWindow.document.write(`
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .section-title { font-weight: bold; background: #f0f0f0; padding: 5px; margin-top: 20px; border: 1px solid #ccc; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background-color: #e0e0e0; }
        .totals { margin-top: 20px; text-align: right; font-weight: bold; }
      </style>
    `)
    printWindow.document.write('</head><body>')
    printWindow.document.write(printContent)
    printWindow.document.write('</body></html>')
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250)
  }

  return (
    <div className="p-4 bg-gray-50 min-h-screen relative">
      <PageHeader title="IP / OP Due Collection" subtitle="Manage IP and OP due collections" />
      
      {/* Search Bar Section */}
      <div className="bg-white border border-gray-300 rounded-sm mt-4 p-4 flex items-center gap-4 shadow-sm">
        <label className="font-bold text-gray-700 whitespace-nowrap">Search Patient</label>
        <input 
          type="text" 
          value={searchQuery}
          readOnly
          onClick={handleOpenModal}
          placeholder="Click here to search patient..."
          className="flex-1 border border-gray-300 p-2 rounded-sm outline-none cursor-pointer bg-gray-50"
        />
        <button onClick={handleOpenModal} className="bg-cyan-400 hover:bg-cyan-500 text-white p-2 rounded-sm px-4 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>
      </div>

      {/* Main Details Area */}
      {loadingDetails ? (
        <div className="text-center py-10 font-bold text-gray-500">Loading patient details...</div>
      ) : patientData ? (
        <div className="mt-6 space-y-4">
          {/* Patient Details */}
          <div className="bg-white border border-gray-300 rounded-sm shadow-sm">
            <div className="border-b border-gray-300 bg-gray-100 p-2 font-bold text-gray-700 flex items-center gap-2">
              <span>👤 Patient Details</span>
            </div>
            <div className="p-4 grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-500 mr-2">Patient Reg.No.</span> <strong>{patientData.patient?.reg_no || '-'}</strong></div>
              <div><span className="text-gray-500 mr-2">Patient Name</span> <strong>{patientData.patient?.name || '-'}</strong></div>
              <div><span className="text-gray-500 mr-2">Phone#</span> <strong>{patientData.patient?.phone || '-'}</strong></div>
            </div>
          </div>

          {/* Due Details Table */}
          <div className="bg-white border border-gray-300 rounded-sm shadow-sm">
            <div className="border-b border-gray-300 bg-gray-100 p-2 font-bold text-gray-700 flex items-center gap-2">
              <span>👤 Due Details</span>
            </div>
            <div className="p-4">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-[#5ba2d6] text-white">
                  <tr>
                    <th className="p-2 border border-gray-300">Invoice No</th>
                    <th className="p-2 border border-gray-300">Invoice Date</th>
                    <th className="p-2 border border-gray-300">Created By</th>
                    <th className="p-2 border border-gray-300">Remarks</th>
                    <th className="p-2 border border-gray-300">Invoice Amount(₹)</th>
                    <th className="p-2 border border-gray-300">Due Status</th>
                    <th className="p-2 border border-gray-300 text-center">Print Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {!patientData.invoices || patientData.invoices.length === 0 ? (
                    <tr><td colSpan="7" className="text-center p-6 text-gray-500 font-medium">No pending dues found for this patient.</td></tr>
                  ) : (
                    patientData.invoices.map((inv, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="p-2 border border-gray-300 font-medium">{inv.invoice_no}</td>
                        <td className="p-2 border border-gray-300">{inv.date}</td>
                        <td className="p-2 border border-gray-300">{inv.created_by}</td>
                        <td className="p-2 border border-gray-300">{inv.remarks}</td>
                        <td className="p-2 border border-gray-300">{inv.amount}</td>
                        <td className="p-2 border border-gray-300">
                          <button 
                            onClick={() => handleOpenCollect(inv)}
                            className="bg-cyan-400 text-white px-3 py-1 rounded-sm text-xs flex items-center gap-1 hover:bg-cyan-500 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                            Receive Payment
                          </button>
                        </td>
                        <td className="p-2 border border-gray-300 text-center text-xl cursor-pointer hover:opacity-70">🖨️</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="4" className="p-2 text-right font-bold border border-gray-300 bg-gray-50">Total Balance Due:</td>
                    <td className="p-2 font-bold border border-gray-300 bg-gray-50">
                      {patientData.invoices ? patientData.invoices.reduce((sum, inv) => sum + Number(inv.due || 0), 0) : 0}
                    </td>
                    <td colSpan="2" className="border border-gray-300 bg-gray-50"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <button onClick={handlePrint} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-sm text-sm font-medium shadow-sm transition-colors">
              Print Statement
            </button>
          </div>
        </div>
      ) : null}

      {/* --- MODAL 1: Select Patient --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl">
            <div className="flex justify-between items-center border-b p-4">
              <h3 className="text-lg font-bold mx-auto text-gray-800">Select Patient</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-red-500 text-2xl leading-none">&times;</button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-600 mb-1">Select Patient Type</label>
                  <select 
                    value={patientType} 
                    onChange={(e) => setPatientType(e.target.value)}
                    className="border border-gray-300 p-1.5 rounded-sm w-40 text-sm outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="INPATIENT">INPATIENT</option>
                    <option value="OUTPATIENT">OUTPATIENT</option>
                    <option value="DIRECT">DIRECT</option>
                  </select>
                </div>
                <button onClick={fetchPatientList} className="bg-[#5ba2d6] hover:bg-blue-600 text-white px-5 py-1.5 text-sm rounded-sm mt-5 shadow-sm transition-colors">Get Data</button>
                
                <div className="ml-auto flex items-center gap-2 mt-5">
                  <span className="text-sm font-bold text-gray-700">Search:</span>
                  <input 
                    type="text" 
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchPatientList()}
                    className="border border-gray-300 p-1.5 rounded-sm outline-none text-sm w-48 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-[#5ba2d6] text-white sticky top-0">
                    <tr>
                      <th className="p-2 border border-gray-300">S.No</th>
                      <th className="p-2 border border-gray-300">Patient Reg No</th>
                      <th className="p-2 border border-gray-300">Patient Name</th>
                      <th className="p-2 border border-gray-300">Patient Phone</th>
                      <th className="p-2 border border-gray-300">Due Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isFetchingList ? (
                      <tr><td colSpan="5" className="text-center p-6 text-gray-500">Loading patients...</td></tr>
                    ) : patientList.length === 0 ? (
                      <tr><td colSpan="5" className="text-center p-6 text-gray-500 font-medium">No records found for this category.</td></tr>
                    ) : (
                      patientList.map((p, idx) => (
                        <tr key={idx} className="border-b hover:bg-blue-50 cursor-pointer transition-colors" onClick={() => handleSelectPatient(p.reg_no)}>
                          <td className="p-2 border border-gray-300">{idx + 1}</td>
                          <td className="p-2 border border-gray-300 font-medium text-blue-600">{p.reg_no}</td>
                          <td className="p-2 border border-gray-300">{p.name}</td>
                          <td className="p-2 border border-gray-300">{p.phone}</td>
                          <td className="p-2 border border-gray-300 font-bold text-red-500">{Number(p.due_amount).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center mt-4 text-sm text-gray-600">
                <div>Showing 1 to {patientList.length} of {patientList.length} entries</div>
                <div className="flex gap-1">
                  <button className="border px-2 py-1 rounded-sm bg-gray-100 hover:bg-gray-200">&laquo;</button>
                  <button className="border px-3 py-1 rounded-sm bg-[#5ba2d6] text-white">1</button>
                  <button className="border px-2 py-1 rounded-sm bg-gray-100 hover:bg-gray-200">&raquo;</button>
                </div>
              </div>
            </div>
            
            <div className="border-t p-4 flex justify-end bg-gray-50">
              <button onClick={() => setIsModalOpen(false)} className="bg-red-400 hover:bg-red-500 text-white px-8 py-2 rounded-sm font-medium transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Collect Due --- */}
      {isCollectModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl">
            <div className="flex justify-between items-center border-b p-4">
              <h3 className="text-lg font-bold text-gray-800">Collect Due</h3>
              <button onClick={() => setIsCollectModalOpen(false)} className="text-gray-500 hover:text-red-500 text-2xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleCollectSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {/* Column 1 */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700">* Invoice Due Amount</label>
                    <input type="text" value={Number(selectedInvoice.due).toFixed(2)} readOnly className="w-full border border-gray-300 p-2 rounded-sm bg-gray-100 mt-1 text-gray-600" />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700">* Net Amount :</label>
                    <input type="text" value={Number(paymentForm.net_amount).toFixed(2)} readOnly className="w-full border border-gray-300 p-2 rounded-sm bg-gray-100 mt-1 text-gray-600" />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700">Remaining Due Amount</label>
                    <input type="text" value={Number(paymentForm.remaining_due).toFixed(2)} readOnly className="w-full border border-gray-300 p-2 rounded-sm bg-gray-100 mt-1 font-bold text-red-600" />
                  </div>
                </div>

                {/* Column 2 */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-gray-700">* Discount Percentage :</label>
                      <input type="number" name="discount_percentage" value={paymentForm.discount_percentage} onChange={handlePaymentChange} className="w-full border border-gray-300 p-2 rounded-sm mt-1 focus:border-blue-500 outline-none" min="0" max="100" />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-700">* Discount Amount :</label>
                      <input type="number" name="discount_amount" value={paymentForm.discount_amount} onChange={handlePaymentChange} className="w-full border border-gray-300 p-2 rounded-sm mt-1 focus:border-blue-500 outline-none" min="0" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-bold text-gray-700">* Payment Mode</label>
                      <select name="payment_mode" value={paymentForm.payment_mode} onChange={handlePaymentChange} className="w-full border border-gray-300 p-2 rounded-sm mt-1 focus:border-blue-500 outline-none bg-white">
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-700">* Paid Amount</label>
                      <input type="number" name="paid_amount" value={paymentForm.paid_amount} onChange={handlePaymentChange} className="w-full border border-gray-300 p-2 rounded-sm mt-1 focus:border-blue-500 outline-none" min="0" required />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-700">*Remarks</label>
                    <textarea name="remarks" value={paymentForm.remarks} onChange={handlePaymentChange} rows="2" className="w-full border border-gray-300 p-2 rounded-sm mt-1 focus:border-blue-500 outline-none"></textarea>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-start gap-4">
                <button type="submit" disabled={isSubmitting} className="bg-cyan-400 hover:bg-cyan-500 disabled:opacity-50 text-white px-8 py-2 rounded-sm font-medium transition-colors">
                  {isSubmitting ? 'Processing...' : 'Collect'}
                </button>
                <button type="button" onClick={() => setIsCollectModalOpen(false)} disabled={isSubmitting} className="bg-red-400 hover:bg-red-500 text-white px-8 py-2 rounded-sm font-medium transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- HIDDEN PRINT LAYOUT --- */}
      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <div className="header">
            <h2>Lakshmi Medical Stores</h2>
            <p>Due Collection Statement</p>
          </div>
          {patientData && (
            <>
              <div className="section-title">Patient Details</div>
              <table>
                <tbody>
                  <tr>
                    <td><strong>Reg No:</strong> {patientData.patient?.reg_no}</td>
                    <td><strong>Name:</strong> {patientData.patient?.name}</td>
                    <td><strong>Phone:</strong> {patientData.patient?.phone}</td>
                  </tr>
                </tbody>
              </table>

              <div className="section-title">Due Details</div>
              <table>
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Date</th>
                    <th>Created By</th>
                    <th>Amount</th>
                    <th>Due Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {patientData.invoices?.map((inv, i) => (
                    <tr key={i}>
                      <td>{inv.invoice_no}</td>
                      <td>{inv.date}</td>
                      <td>{inv.created_by}</td>
                      <td>{inv.amount}</td>
                      <td>{inv.due}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="totals">
                Total Due: ₹{patientData.invoices?.reduce((sum, inv) => sum + Number(inv.due || 0), 0) || 0}
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  )
}