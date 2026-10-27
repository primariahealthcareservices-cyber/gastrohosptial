import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Plus, X } from 'lucide-react'
import api from '../../../api/axios'
import { PageHeader } from '../../../components/PageHeader'

const DEFAULT_LIMIT = 10

const EMPTY_PATIENT = {
  op_registration_id: null,
  regNo: '',
  mobile: '',
  name: '',
  gender: 'Male',
  age: '',
  doctorId: '',
}

const newItem = () => ({
  id: Date.now() + Math.random(),
  name: '',
  batch: '',
  oldTax: 0,
  newTax: 0,
  grn: '',
  qty: 1,
  mrp: 0,
})

function Modal({ open, onClose, children, width = 'max-w-4xl' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 px-4 pt-12"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative mb-10 w-full ${width} rounded-md bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={18} />
        </button>
        {children}
      </div>
    </div>,
    document.body
  )
}

export default function PharmacyOPSales() {
  const [mode, setMode] = useState('OP')
  const [patient, setPatient] = useState(EMPTY_PATIENT)
  const [doctors, setDoctors] = useState([])

  // Search Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalPage, setModalPage] = useState(1)
  const [modalLimit, setModalLimit] = useState(DEFAULT_LIMIT)
  const [modalTotal, setModalTotal] = useState(0)
  const [modalFromDate, setModalFromDate] = useState('')
  const [modalToDate, setModalToDate] = useState('')
  const [modalSearch, setModalSearch] = useState('')
  const [modalData, setModalData] = useState([])
  const [loadingModal, setLoadingModal] = useState(false)
  const [modalError, setModalError] = useState('')

  // Drug Combination Modal State
  const [isDrugComboOpen, setIsDrugComboOpen] = useState(false)
  const [comboSearch, setComboSearch] = useState('')
  const [comboAll, setComboAll] = useState([])
  const [comboPage, setComboPage] = useState(1)
  const [loadingCombo, setLoadingCombo] = useState(false)
  const [comboError, setComboError] = useState('')

  // Sales Form State
  const [items, setItems] = useState([newItem()])
  const [payment, setPayment] = useState({ discountPercent: 0, mode: 'Cash', paid: 0, remarks: 'NA' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load Doctors
  useEffect(() => {
    api
      .get('/pharmacy-op-sales/doctors')
      .then((res) => {
        const data = res.data?.doctors || res.data
        setDoctors(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        console.error('Error loading doctors:', err)
        setDoctors([])
      })
  }, [])

  // Totals calculation
  const rowAmount = (i) => Number(i.qty || 0) * Number(i.mrp || 0)
  const totals = useMemo(() => {
    const total = items.reduce((s, i) => s + rowAmount(i), 0)
    const discountAmount = (total * Number(payment.discountPercent || 0)) / 100
    const net = total - discountAmount
    const due = Math.max(0, net - Number(payment.paid || 0))
    return {
      total: total.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      net: net.toFixed(2),
      due: due.toFixed(2),
    }
  }, [items, payment.discountPercent, payment.paid])

  // Fetch OP Patients
  const fetchPatients = async (overridePage = modalPage) => {
    setLoadingModal(true)
    setModalError('')
    try {
      const res = await api.get('/pharmacy-op-sales/search-patients', {
        params: {
          search: modalSearch,
          page: overridePage,
          limit: modalLimit,
          from_date: modalFromDate,
          to_date: modalToDate,
        },
      })
      setModalData(res.data.data || [])
      setModalTotal(res.data.total || 0)
      setModalPage(overridePage)
    } catch (err) {
      setModalData([])
      setModalTotal(0)
      setModalError(err.response?.data?.error || 'Could not load patients.')
    } finally {
      setLoadingModal(false)
    }
  }

  const handleGetData = (e) => {
    e.preventDefault()
    fetchPatients(1)
  }

  const openSearch = () => {
    setIsModalOpen(true)
    setModalPage(1)
    setModalSearch('')
    fetchPatients(1)
  }

  const closeModal = () => {
    setIsModalOpen(false)
  }

  const handleSelectPatient = (p) => {
    setPatient({
      op_registration_id: p.id,
      regNo: p.opd_reg_no || '',
      mobile: p.mobile || '',
      name: p.name || '',
      gender: p.gender || 'Male',
      age: p.age ?? '',
      doctorId: p.doctor_id ? String(p.doctor_id) : '',
    })
    closeModal()
  }

  // Drug Combination
  const fetchCombinations = async () => {
    setLoadingCombo(true)
    setComboError('')
    try {
      const res = await api.get('/pharmacy-op-sales/search-combinations')
      setComboAll(res.data.data || [])
    } catch (err) {
      setComboAll([])
      setComboError(err.response?.data?.error || 'Could not load items.')
    } finally {
      setLoadingCombo(false)
    }
  }

  const openComboModal = () => {
    setIsDrugComboOpen(true)
    setComboSearch('')
    setComboPage(1)
    fetchCombinations()
  }

  const closeComboModal = () => {
    setIsDrugComboOpen(false)
  }

  const handleSelectDrug = (drug) => {
    const row = {
      id: Date.now() + Math.random(),
      name: drug.item_name,
      batch: '',
      oldTax: 0,
      newTax: 0,
      grn: '',
      qty: 1,
      mrp: drug.mrp || 0,
    }
    setItems((prev) =>
      prev.length === 1 && !prev[0].name.trim() ? [row] : [...prev, row]
    )
    closeComboModal()
  }

  const filteredCombos = useMemo(() => {
    const q = comboSearch.trim().toLowerCase()
    if (!q) return comboAll
    return comboAll.filter((r) =>
      `${r.item_name} ${r.drug_combination}`.toLowerCase().includes(q)
    )
  }, [comboAll, comboSearch])

  const pagedCombos = filteredCombos.slice(
    (comboPage - 1) * DEFAULT_LIMIT,
    comboPage * DEFAULT_LIMIT
  )
  const totalComboPages = Math.max(1, Math.ceil(filteredCombos.length / DEFAULT_LIMIT))

  const changeMode = (m) => {
    setMode(m)
    setPatient(EMPTY_PATIENT)
  }
  const setP = (field, value) => setPatient((prev) => ({ ...prev, [field]: value }))

  const handleItemChange = (index, field, value) =>
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    )
  const addNewItem = () => setItems((prev) => [...prev, newItem()])
  const removeItem = (index) =>
    setItems((prev) =>
      prev.length === 1 ? [newItem()] : prev.filter((_, i) => i !== index)
    )
  const handlePaymentChange = (field, value) =>
    setPayment((prev) => ({ ...prev, [field]: value }))

  const resetForm = () => {
    setPatient(EMPTY_PATIENT)
    setItems([newItem()])
    setPayment({ discountPercent: 0, mode: 'Cash', paid: 0, remarks: 'NA' })
  }

  const handleSubmit = async (isDraft = false) => {
    if (!patient.name.trim()) return alert('Patient name is required.')
    if (!patient.mobile.trim()) return alert('Mobile number is required.')
    if (!patient.age) return alert('Age is required. Please enter the age.')
    if (mode === 'OP' && !patient.op_registration_id)
      return alert('Search and select the OP patient first.')
    if (!items.some((i) => i.name.trim()))
      return alert('Please add at least one item with a name.')

    setIsSubmitting(true)
    try {
      const payload = {
        sale_type: 'OP',
        op_sale_mode: mode,
        op_registration_id: mode === 'OP' ? patient.op_registration_id : null,
        patient_name: patient.name,
        mobile: patient.mobile,
        gender: patient.gender,
        age: patient.age,
        doctor_id: patient.doctorId || null,
        store_id: 1,
        payment_mode: payment.mode,
        discount_percent: payment.discountPercent,
        paid_amount: payment.paid,
        remarks: payment.remarks,
        save_as_draft: isDraft,
        items: items
          .filter((i) => i.name.trim())
          .map((i) => ({
            item_name: i.name,
            batch_no: i.batch,
            old_tax_percent: i.oldTax,
            new_tax_percent: i.newTax,
            grn_id: i.grn,
            qty: i.qty,
            mrp: i.mrp,
          })),
      }
      await api.post('/pharmacy-sales', payload)
      alert(`Sale ${isDraft ? 'saved as draft' : 'submitted'} successfully!`)
      resetForm()
    } catch (err) {
      alert('Failed to submit sale: ' + (err.response?.data?.error || err.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(modalTotal / modalLimit))
  const fromCount = modalTotal === 0 ? 0 : (modalPage - 1) * modalLimit + 1
  const toCount = Math.min(modalPage * modalLimit, modalTotal)

  const field = 'border border-gray-300 rounded-sm p-2 mt-1 w-full text-sm'
  const readonlyField = `${field} bg-gray-100`
  
  const locked = mode === 'OP' && !!patient.op_registration_id
  // We only lock the Age if it exists AND we are not explicitly allowing edits.
  // To allow edits for wrong ages, we remove the lock entirely on the age field.
  const ageLocked = false; 

  return (
    <div className="bg-gray-50 min-h-screen p-4">
      <PageHeader title="Out Patient Sales Form" />

      {/* PATIENT DETAILS */}
      <div className="bg-white border border-gray-300 rounded-sm mb-4">
        <div className="bg-[#4da3d9] text-white px-4 py-2 font-semibold flex justify-between items-center">
          <span>Patient Details</span>
          <button
            type="button"
            className="bg-[#33c3f0] hover:bg-cyan-500 text-white px-4 py-1 text-sm rounded"
          >
            Get Sale Drafts
          </button>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-center gap-8 mb-6 text-sm">
            {['OP', 'Direct'].map((m) => (
              <label
                key={m}
                className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800"
              >
                <input
                  type="radio"
                  name="op-mode"
                  checked={mode === m}
                  onChange={() => changeMode(m)}
                  className="w-4 h-4 text-blue-600"
                />
                {m}
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-semibold text-red-500">* Patient Reg No</label>
              <div className="flex mt-1">
                <input
                  className={`border border-gray-300 rounded-l-sm p-2 w-full text-sm cursor-pointer ${locked ? 'bg-gray-100' : ''}`}
                  placeholder="Click to Search OP Patient"
                  value={patient.regNo}
                  readOnly={true}
                  onClick={() => !locked && openSearch()}
                />
                {mode === 'OP' && (
                  <button
                    type="button"
                    onClick={openSearch}
                    className="bg-gray-100 border border-l-0 border-gray-300 px-3 hover:bg-gray-200 rounded-r-sm"
                    title="Search Existing OP Patient"
                  >
                    <Search size={16} className="text-gray-600" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-red-500">* Mobile</label>
              <div className="flex mt-1">
                <span className="flex items-center border border-r-0 border-gray-300 bg-gray-100 px-2 text-sm text-gray-600 rounded-l-sm whitespace-nowrap">
                  India (+91)
                </span>
                <input
                  className={`border border-gray-300 p-2 w-full text-sm rounded-r-sm ${locked ? 'bg-gray-100' : ''}`}
                  placeholder="Mobile"
                  maxLength={10}
                  value={patient.mobile}
                  readOnly={locked}
                  onChange={(e) => setP('mobile', e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-red-500">* Patient Name</label>
              <input
                className={locked ? readonlyField : field}
                value={patient.name}
                readOnly={locked}
                onChange={(e) => setP('name', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-red-500">* Age/Gender</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  placeholder="Age"
                  // Removed the readOnly restriction so you can always edit it
                  className="border border-gray-300 p-2 w-20 text-sm rounded-sm"
                  value={patient.age}
                  onChange={(e) => {
                    // Only allow digits
                    const val = e.target.value.replace(/\D/g, '')
                    setP('age', val)
                  }}
                />
                <select
                  // Removed the disabled restriction so you can always edit it
                  className="border border-gray-300 p-2 w-full text-sm rounded-sm"
                  value={patient.gender}
                  onChange={(e) => setP('gender', e.target.value)}
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Doctor Name</label>
              <select
                className={field}
                value={patient.doctorId}
                onChange={(e) => setP('doctorId', e.target.value)}
              >
                <option value="">Select</option>
                {Array.isArray(doctors) &&
                  doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Select Pharmacy Store</label>
              <select className={field}>
                <option value="1">Main Store</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-gray-700">Barcode</label>
              <div className="flex mt-1">
                <input
                  className="border border-gray-300 rounded-l-sm p-2 w-full text-sm"
                  placeholder="Scan or enter barcode"
                />
                <button
                  type="button"
                  className="bg-gray-200 border border-l-0 border-gray-300 px-3 text-sm"
                >
                  Scan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ITEM DETAILS */}
      <div className="bg-white border border-gray-300 rounded-sm mb-4">
        <div className="bg-[#4da3d9] text-white px-4 py-2 font-semibold flex justify-between items-center">
          <span>Item Details</span>
          <button type="button" className="text-white hover:text-gray-200 text-sm">
            Return Medicines
          </button>
        </div>
        <div className="p-4">
          <div className="flex gap-4 mb-3 text-sm">
            <button
              type="button"
              onClick={addNewItem}
              className="text-[#337ab7] font-semibold flex items-center gap-1 hover:underline"
            >
              <Plus size={16} /> Add New
            </button>
            <button
              type="button"
              className="text-[#337ab7] font-semibold flex items-center gap-1 hover:underline"
            >
              <Plus size={16} /> Add Package
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={openComboModal}
              className="bg-[#4da3d9] text-white px-4 py-1 rounded-sm flex items-center gap-1"
            >
              <Search size={14} /> Drug Combination
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f5f5f5] text-left border-b border-gray-300 text-gray-700">
                  <th className="p-2 border-r border-gray-300 w-12 text-center">SNo</th>
                  <th className="p-2 border-r border-gray-300 w-1/3">Item Name</th>
                  <th className="p-2 border-r border-gray-300 w-24">Batch No</th>
                  <th className="p-2 border-r border-gray-300 w-20 text-center">Old Tax(%)</th>
                  <th className="p-2 border-r border-gray-300 w-20 text-center text-red-500">New Tax(%)</th>
                  <th className="p-2 border-r border-gray-300 w-20 text-center">GrnId</th>
                  <th className="p-2 border-r border-gray-300 w-16 text-center">Qty</th>
                  <th className="p-2 border-r border-gray-300 w-24 text-center">MRP (₹)</th>
                  <th className="p-2 border-r border-gray-300 w-28 text-center">Amount (₹)</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="p-2 border-r border-gray-300 text-center">{index + 1}</td>
                    <td className="p-1 border-r border-gray-300">
                      <input
                        className="w-full p-1 outline-none"
                        placeholder="Enter medicine name"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-r border-gray-300">
                      <input
                        className="w-full p-1 outline-none bg-gray-50 text-center"
                        value={item.batch}
                        onChange={(e) => handleItemChange(index, 'batch', e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-r border-gray-300">
                      <input
                        className="w-full p-1 outline-none bg-gray-50 text-center"
                        value={item.oldTax}
                        onChange={(e) => handleItemChange(index, 'oldTax', e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-r border-gray-300">
                      <input
                        className="w-full p-1 outline-none bg-gray-50 text-center"
                        value={item.newTax}
                        onChange={(e) => handleItemChange(index, 'newTax', e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-r border-gray-300">
                      <input
                        className="w-full p-1 outline-none bg-gray-50 text-center"
                        value={item.grn}
                        onChange={(e) => handleItemChange(index, 'grn', e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-r border-gray-300">
                      <input
                        type="number"
                        min="0"
                        className="w-full p-1 outline-none text-center border border-transparent focus:border-blue-300"
                        value={item.qty}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-r border-gray-300">
                      <input
                        type="number"
                        min="0"
                        className="w-full p-1 outline-none text-center border border-transparent focus:border-blue-300"
                        value={item.mrp}
                        onChange={(e) => handleItemChange(index, 'mrp', e.target.value)}
                      />
                    </td>
                    <td className="p-1 border-r border-gray-300">
                      <input
                        className="w-full p-1 outline-none bg-gray-50 text-right"
                        value={rowAmount(item).toFixed(2)}
                        readOnly
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-blue-500 hover:text-red-500"
                      >
                        <X size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PAYMENT DETAILS */}
      <div className="bg-white border border-gray-300 rounded-sm mb-4">
        <div className="bg-[#4da3d9] text-white px-4 py-2 font-semibold">Payment Details</div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div>
            <label className="text-gray-600 font-semibold">Total Amount(₹)</label>
            <input className={readonlyField} value={totals.total} readOnly />
          </div>
          <div>
            <label className="text-gray-600 font-semibold">Discount(%)</label>
            <input
              type="number"
              min="0"
              max="100"
              className={field}
              value={payment.discountPercent}
              onChange={(e) => handlePaymentChange('discountPercent', e.target.value)}
            />
          </div>
          <div>
            <label className="text-gray-600 font-semibold">Discount Amount(₹)</label>
            <input className={readonlyField} value={totals.discountAmount} readOnly />
          </div>
          <div>
            <label className="text-gray-600 font-semibold">Net Amount(₹)</label>
            <input className={`${readonlyField} font-bold`} value={totals.net} readOnly />
          </div>
          <div>
            <label className="text-red-500 font-semibold">* Payment Mode</label>
            <select
              className={field}
              value={payment.mode}
              onChange={(e) => handlePaymentChange('mode', e.target.value)}
            >
              <option>Cash</option>
              <option>Card</option>
              <option>UPI</option>
              <option>Insurance</option>
              <option>Credit</option>
            </select>
          </div>
          <div>
            <label className="text-red-500 font-semibold">* Paid Amount</label>
            <input
              type="number"
              min="0"
              className={field}
              value={payment.paid}
              onChange={(e) => handlePaymentChange('paid', e.target.value)}
            />
          </div>
          <div>
            <label className="text-red-500 font-semibold">* Due Amount</label>
            <input className={readonlyField} value={totals.due} readOnly />
          </div>
          <div>
            <label className="text-red-500 font-semibold">* Remarks</label>
            <input
              className={field}
              value={payment.remarks}
              onChange={(e) => handlePaymentChange('remarks', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex justify-center gap-4 mt-6 mb-10">
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting}
          className="bg-gray-200 text-gray-700 px-6 py-2 rounded-sm font-semibold hover:bg-gray-300 disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          type="button"
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting}
          className="bg-[#1a4f76] text-white px-8 py-2 rounded-sm font-semibold hover:bg-[#153f5e] disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'SUBMIT'}
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="bg-[#e5b75d] text-white px-6 py-2 rounded-sm font-semibold hover:bg-[#d1a24a]"
        >
          Clear
        </button>
      </div>

      {/* OP PATIENT SEARCH MODAL */}
      <Modal open={isModalOpen} onClose={closeModal} width="max-w-4xl">
        <div className="px-8 pt-8 pb-6">
          <form onSubmit={handleGetData} className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span>Show</span>
              <select
                className="border border-gray-300 rounded-sm px-2 py-1 focus:outline-none"
                value={modalLimit}
                onChange={(e) => {
                  const newLimit = Number(e.target.value)
                  setModalLimit(newLimit)
                  fetchPatients(1)
                }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>entries</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                className="border border-gray-300 rounded-sm px-2 py-1 text-sm"
                value={modalFromDate}
                onChange={(e) => setModalFromDate(e.target.value)}
              />
              <input
                type="date"
                className="border border-gray-300 rounded-sm px-2 py-1 text-sm"
                value={modalToDate}
                onChange={(e) => setModalToDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end">
              <input
                type="text"
                className="border border-gray-400 rounded-sm px-3 py-1.5 text-sm w-64 outline-none focus:border-blue-500"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder="Search..."
              />
              <button
                type="submit"
                className="bg-[#33c3f0] hover:bg-cyan-500 text-white px-4 py-1.5 text-sm rounded"
              >
                Get Data
              </button>
            </div>
          </form>

          <div className="max-h-[55vh] overflow-auto border-t border-gray-200">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0">
                <tr>
                  <th className="bg-[#4da3d9] px-4 py-2.5 font-semibold text-white border-r border-white/30">
                    MR Number
                  </th>
                  <th className="bg-[#4da3d9] px-4 py-2.5 font-semibold text-white border-r border-white/30">
                    Patient Reg No.
                  </th>
                  <th className="bg-[#4da3d9] px-4 py-2.5 font-semibold text-white border-r border-white/30">
                    Name
                  </th>
                  <th className="bg-[#4da3d9] px-4 py-2.5 font-semibold text-white border-r border-white/30">
                    Age / Gender
                  </th>
                  <th className="bg-[#4da3d9] px-4 py-2.5 font-semibold text-white">Phone</th>
                </tr>
              </thead>
              <tbody>
                {loadingModal ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-gray-500">
                      Loading patients...
                    </td>
                  </tr>
                ) : modalError ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-red-500">
                      {modalError}
                    </td>
                  </tr>
                ) : modalData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-gray-500">
                      No patients found.
                    </td>
                  </tr>
                ) : (
                  modalData.map((pt, idx) => (
                    <tr
                      key={pt.id ?? idx}
                      onClick={() => handleSelectPatient(pt)}
                      className="cursor-pointer odd:bg-white even:bg-gray-50 hover:bg-blue-50 border-b border-gray-100"
                    >
                      <td className="px-4 py-2 text-gray-700">{pt.mr_number || 'N/A'}</td>
                      <td className="px-4 py-2 text-gray-700">{pt.opd_reg_no}</td>
                      <td className="px-4 py-2 text-gray-800">{pt.name}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {pt.gender} / {pt.age ? `${pt.age}Y` : ''}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{pt.mobile}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing {fromCount} to {toCount} of {modalTotal} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={modalPage === 1}
                onClick={() => fetchPatients(modalPage - 1)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                &laquo;
              </button>
              <button
                type="button"
                className="rounded border border-[#1f2a44] bg-[#1f2a44] px-3 py-1.5 text-sm font-semibold text-white"
              >
                {modalPage}
              </button>
              <button
                type="button"
                disabled={modalPage >= totalPages}
                onClick={() => fetchPatients(modalPage + 1)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* DRUG COMBINATION MODAL */}
      <Modal open={isDrugComboOpen} onClose={closeComboModal} width="max-w-5xl">
        <div className="px-10 pt-8 pb-6">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-800">Item Name :</label>
              <input
                type="text"
                autoFocus
                className="w-48 rounded-sm border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-[#4da3d9]"
                value={comboSearch}
                onChange={(e) => {
                  setComboSearch(e.target.value)
                  setComboPage(1)
                }}
              />
            </div>
          </div>

          <div className="max-h-[55vh] overflow-auto border border-gray-200">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0">
                <tr>
                  <th className="bg-[#4da3d9] px-4 py-2 font-semibold text-white border-r border-white/30">
                    Item Name
                  </th>
                  <th className="bg-[#4da3d9] px-4 py-2 font-semibold text-white border-r border-white/30">
                    Drug Combination
                  </th>
                  <th className="bg-[#4da3d9] px-4 py-2 font-semibold text-white w-24 text-center">
                    Qty
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingCombo ? (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-gray-500">
                      Loading items...
                    </td>
                  </tr>
                ) : comboError ? (
                  <tr>
                                       <td colSpan="3" className="py-8 text-center text-red-600">
                      {comboError}
                    </td>
                  </tr>
                ) : pagedCombos.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="py-8 text-center text-gray-500">
                      No items found.
                    </td>
                  </tr>
                ) : (
                  pagedCombos.map((drug, idx) => (
                    <tr
                      key={drug.id ?? idx}
                      onClick={() => handleSelectDrug(drug)}
                      className="cursor-pointer border-b border-gray-200 hover:bg-blue-50 odd:bg-white even:bg-gray-50"
                    >
                      <td className="px-4 py-2 text-gray-800">{drug.item_name}</td>
                      <td className="px-4 py-2 text-gray-600">{drug.drug_combination}</td>
                      <td className="px-4 py-2 text-center text-gray-800 font-semibold">
                        {drug.qty}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing {(comboPage - 1) * DEFAULT_LIMIT + 1} to{' '}
              {Math.min(comboPage * DEFAULT_LIMIT, filteredCombos.length)} of{' '}
              {filteredCombos.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={comboPage === 1}
                onClick={() => setComboPage((p) => p - 1)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                &laquo;
              </button>
              <button
                type="button"
                className="rounded border border-[#1f2a44] bg-[#1f2a44] px-3 py-1.5 text-sm font-semibold text-white"
              >
                {comboPage}
              </button>
              <button
                type="button"
                disabled={comboPage >= totalComboPages}
                onClick={() => setComboPage((p) => p + 1)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}