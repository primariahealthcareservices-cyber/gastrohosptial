import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, Plus, X } from 'lucide-react'
import api from '../../../api/axios'
import { PageHeader } from '../../../components/PageHeader'

const PAGE_SIZE = 10
const DEFAULT_STORES = [{ id: 1, name: 'Main Store' }]

const EMPTY_PATIENT = {
  ip_registration_id: null, regNo: '', mrNumber: '', name: '', mobile: '', ageGender: '', doctor: '', roomDetails: '',
}

const newItem = () => ({
  id: Date.now() + Math.random(), name: '', batch: '', oldTax: 0, newTax: 0, grn: '', qty: 1, mrp: 0,
})

/* Pull a list out of whatever shape an endpoint returns: [..] | {data:[..]} | {items:[..]} */
const toList = (d) => {
  if (Array.isArray(d)) return d
  if (Array.isArray(d?.data)) return d.data
  if (Array.isArray(d?.items)) return d.items
  if (Array.isArray(d?.rows)) return d.rows
  return []
}
const firstDefined = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '')
const errText = (err) =>
  err?.response?.data?.detail || err?.response?.data?.error ||
  `${err?.message || 'Request failed'}${err?.response?.status ? ` (HTTP ${err.response.status})` : ''}`

function Modal({ open, onClose, children, width = 'max-w-4xl' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 px-4 pt-12" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={`relative mb-10 w-full ${width} rounded-md bg-white shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>
        {children}
      </div>
    </div>, document.body
  )
}

function Pager({ page, setPage, total }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const buttons = []
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) buttons.push(p)
  return (
    <div className="mt-5 flex items-center justify-between">
      <span className="text-sm text-gray-600">Showing {from} to {to} of {total} entries</span>
      <div className="flex gap-1">
        <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">&laquo;</button>
        {buttons.map((p) => (
          <button type="button" key={p} onClick={() => setPage(p)} className={`rounded border px-3 py-1.5 text-sm font-semibold ${p === page ? 'border-[#1f2a44] bg-[#1f2a44] text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'}`}>{p}</button>
        ))}
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">&raquo;</button>
      </div>
    </div>
  )
}

export default function PharmacyIPSales() {
  const [patient, setPatient] = useState(EMPTY_PATIENT)
  const [stores, setStores] = useState(DEFAULT_STORES)
  const [selectedStoreId, setSelectedStoreId] = useState(1)

  // IP patient modal (data is loaded in full, paginated here)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalAll, setModalAll] = useState([])
  const [modalPage, setModalPage] = useState(1)
  const [loadingModal, setLoadingModal] = useState(false)
  const [modalError, setModalError] = useState('')

  // drafts modal
  const [isDraftOpen, setIsDraftOpen] = useState(false)
  const [drafts, setDrafts] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(false)

  // drug combination / item modal
  const [isDrugComboOpen, setIsDrugComboOpen] = useState(false)
  const [comboSearch, setComboSearch] = useState('')
  const [comboAll, setComboAll] = useState([])
  const [comboPage, setComboPage] = useState(1)
  const [loadingCombo, setLoadingCombo] = useState(false)
  const [comboError, setComboError] = useState('')

  const [items, setItems] = useState([newItem()])
  const [payment, setPayment] = useState({ discountPercent: 0, mode: 'Cash', paid: 0, remarks: 'NA' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  /* ---------- Stores (never empty) ---------- */
  useEffect(() => {
    api.get('/pharmacy-ip-sales/stores')
      .then((res) => {
        const list = toList(res.data?.stores ?? res.data)
        if (list.length > 0) { setStores(list); setSelectedStoreId(list[0].id) }
      })
      .catch((err) => console.error('Stores fetch failed, using default store:', errText(err)))
  }, [])

  /* ---------- Totals ---------- */
  const rowAmount = (i) => Number(i.qty || 0) * Number(i.mrp || 0)
  const totals = useMemo(() => {
    const total = items.reduce((s, i) => s + rowAmount(i), 0)
    const discountAmount = (total * Number(payment.discountPercent || 0)) / 100
    const net = total - discountAmount
    const due = Math.max(0, net - Number(payment.paid || 0))
    return { total: total.toFixed(2), discountAmount: discountAmount.toFixed(2), net: net.toFixed(2), due: due.toFixed(2) }
  }, [items, payment.discountPercent, payment.paid])

  /* ---------- IP patients: Fetch from specific backend ---------- */
  useEffect(() => {
    if (!isModalOpen) return
    let cancelled = false
    ;(async () => {
      setLoadingModal(true); setModalError('')
      try {
        const res = await api.get('/pharmacy-ip-sales/search-patients')
        if (cancelled) return
        const rows = toList(res.data)
        setModalAll(rows)
      } catch (err) {
        if (cancelled) return
        console.error('IP patients fetch failed:', err)
        setModalAll([]); setModalError(`Could not load IP patients: ${errText(err)}`)
      } finally {
        if (!cancelled) setLoadingModal(false)
      }
    })()
    return () => { cancelled = true }
  }, [isModalOpen])

  const filteredPatients = useMemo(() => {
    const q = modalSearch.trim().toLowerCase()
    if (!q) return modalAll
    return modalAll.filter((r) =>
      [r.name, r.mobile, r.ip_reg_no, r.mr_number, r.patient_reg_no]
        .some((v) => String(v || '').toLowerCase().includes(q))
    )
  }, [modalAll, modalSearch])
  const pagedPatients = filteredPatients.slice((modalPage - 1) * PAGE_SIZE, modalPage * PAGE_SIZE)

  /* ---------- Items / item types with quantity ---------- */
  useEffect(() => {
    if (!isDrugComboOpen) return
    let cancelled = false
    ;(async () => {
      setLoadingCombo(true); setComboError('')
      try {
        const res = await api.get('/pharmacy-ip-sales/search-combinations')
        if (cancelled) return
        const rows = toList(res.data).map((r, idx) => ({
          id: r.id ?? idx,
          item_name: firstDefined(r.item_name, r.name, '') + '',
          drug_combination: firstDefined(r.drug_combination, '') + '',
          qty: Number(firstDefined(r.qty, 0)),
          mrp: Number(firstDefined(r.mrp, 0)),
        }))
        setComboAll(rows)
      } catch (err) {
        if (cancelled) return
        console.error('Items fetch failed:', err)
        setComboAll([]); setComboError(`Could not load items: ${errText(err)}`)
      } finally {
        if (!cancelled) setLoadingCombo(false)
      }
    })()
    return () => { cancelled = true }
  }, [isDrugComboOpen])

  const filteredCombos = useMemo(() => {
    const q = comboSearch.trim().toLowerCase()
    if (!q) return comboAll
    return comboAll.filter((r) => `${r.item_name} ${r.drug_combination}`.toLowerCase().includes(q))
  }, [comboAll, comboSearch])
  const pagedCombos = filteredCombos.slice((comboPage - 1) * PAGE_SIZE, comboPage * PAGE_SIZE)

  /* ---------- Handlers ---------- */
  const closeModal = () => { setIsModalOpen(false); setModalSearch(''); setModalPage(1) }
  const closeComboModal = () => { setIsDrugComboOpen(false); setComboSearch(''); setComboPage(1) }

  const handleSelectPatient = (p) => {
    setPatient({
      ip_registration_id: p.id,
      regNo: p.ip_reg_no || '',
      mrNumber: p.mr_number || '',
      name: p.name || '',
      mobile: p.mobile || '',
      ageGender: `${p.age || ''}${p.age ? 'Y' : ''} / ${p.gender || ''}`,
      doctor: p.doctor_name || 'N/A',
      roomDetails: [p.floor, p.room_type, p.room_no, p.bed_no].map((v) => v || '-').join(' / '),
    })
    closeModal()
  }

  const handleSelectDrug = (drug) => {
    const row = { id: Date.now() + Math.random(), name: drug.item_name, batch: '', oldTax: 0, newTax: 0, grn: '', qty: 1, mrp: drug.mrp || 0 }
    setItems((prev) => (prev.length === 1 && !prev[0].name.trim() ? [row] : [...prev, row]))
    closeComboModal()
  }

  const openDrafts = async () => {
    if (!patient.ip_registration_id) return alert('Please select a patient first.')
    setIsDraftOpen(true); setLoadingDrafts(true)
    try {
      const res = await api.get(`/pharmacy-ip-sales/drafts/${patient.ip_registration_id}`)
      setDrafts(toList(res.data))
    } catch (err) {
      setDrafts([])
    } finally {
      setLoadingDrafts(false)
    }
  }

  const handleItemChange = (index, field, value) => setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)))
  const addNewItem = () => setItems((prev) => [...prev, newItem()])
  const removeItem = (index) => setItems((prev) => (prev.length === 1 ? [newItem()] : prev.filter((_, i) => i !== index)))
  const handlePaymentChange = (field, value) => setPayment((prev) => ({ ...prev, [field]: value }))

  const resetForm = () => {
    setPatient(EMPTY_PATIENT); setItems([newItem()]); setPayment({ discountPercent: 0, mode: 'Cash', paid: 0, remarks: 'NA' })
  }

  const handleSubmit = async (isDraft = false) => {
    if (!patient.ip_registration_id) return alert('Please select a patient first.')
    if (!selectedStoreId) return alert('No pharmacy store selected.')
    if (!items.some((i) => i.name.trim())) return alert('Please add at least one item with a name.')

    setIsSubmitting(true)
    try {
      const payload = {
        sale_type: 'IP', ip_registration_id: patient.ip_registration_id, store_id: Number(selectedStoreId),
        payment_mode: payment.mode, discount_percent: payment.discountPercent, paid_amount: payment.paid,
        remarks: payment.remarks, save_as_draft: isDraft,
        items: items.filter((i) => i.name.trim()).map((i) => ({
          item_name: i.name, batch_no: i.batch, old_tax_percent: i.oldTax, new_tax_percent: i.newTax, grn_id: i.grn, qty: i.qty, mrp: i.mrp,
        })),
      }
      await api.post('/pharmacy-sales', payload)
      alert(`Sale ${isDraft ? 'saved as draft' : 'submitted'} successfully!`)
      resetForm()
    } catch (err) {
      alert('Failed to submit sale: ' + errText(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const field = 'border border-gray-300 rounded-sm p-2 mt-1 w-full text-sm'
  const readonlyField = `${field} bg-gray-100`

  return (
    <div className="bg-gray-50 min-h-screen p-4">
      <PageHeader title="In Patient Sales Form" />

      {/* Patient Details */}
      <div className="bg-white border border-gray-300 rounded-sm mb-4">
        <div className="bg-[#4da3d9] text-white px-4 py-2 font-semibold flex justify-between items-center">
          <span>Patient Details</span>
          <button type="button" onClick={openDrafts} className="bg-[#33c3f0] hover:bg-cyan-500 text-white px-4 py-1 text-sm rounded">Get Sale Drafts</button>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-semibold text-red-500">* Registration</label>
            <div className="flex mt-1">
              <input className="border border-gray-300 rounded-l-sm p-2 w-full bg-gray-100 text-sm cursor-pointer" value={patient.regNo} readOnly placeholder="Click to search IP patient" onClick={() => setIsModalOpen(true)} />
              <button type="button" onClick={() => setIsModalOpen(true)} className="bg-gray-100 border border-l-0 border-gray-300 px-3 hover:bg-gray-200 rounded-r-sm"><Search size={16} className="text-gray-600" /></button>
            </div>
          </div>
          <div><label className="text-sm font-semibold text-gray-700">Name</label><input className={readonlyField} value={patient.name} readOnly /></div>
          <div><label className="text-sm font-semibold text-gray-700">Mobile#</label><input className={readonlyField} value={patient.mobile} readOnly /></div>
          <div><label className="text-sm font-semibold text-gray-700">Age/Gender</label><input className={readonlyField} value={patient.ageGender} readOnly /></div>
          <div className="md:col-span-2"><label className="text-sm font-semibold text-gray-700">Doctor</label><input className={readonlyField} value={patient.doctor} readOnly /></div>
          <div className="md:col-span-2"><label className="text-sm font-semibold text-gray-700">Floor/Room Type/Room No/Bed No</label><input className={readonlyField} value={patient.roomDetails} readOnly /></div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Select Pharmacy Store</label>
            <select className={field} value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-sm font-semibold text-gray-700">Barcode</label>
            <div className="flex mt-1">
              <input className="border border-gray-300 rounded-l-sm p-2 w-full text-sm" placeholder="Scan or enter barcode" />
              <button type="button" className="bg-gray-200 border border-l-0 border-gray-300 px-3 text-sm">Scan</button>
            </div>
          </div>
        </div>
      </div>

      {/* Item Details */}
      <div className="bg-white border border-gray-300 rounded-sm mb-4">
        <div className="bg-[#4da3d9] text-white px-4 py-2 font-semibold flex justify-between items-center">
          <span>Item Details</span>
          <button type="button" className="text-white hover:text-gray-200 text-sm">Return Medicines</button>
        </div>
        <div className="p-4">
          <div className="flex gap-4 mb-3 text-sm">
            <button type="button" onClick={addNewItem} className="text-[#337ab7] font-semibold flex items-center gap-1 hover:underline"><Plus size={16} /> Add New</button>
            <div className="flex-1" />
            <button type="button" onClick={() => setIsDrugComboOpen(true)} className="bg-[#4da3d9] text-white px-4 py-1 rounded-sm flex items-center gap-1"><Search size={14} /> Drug Combination</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#f5f5f5] text-left border-b border-gray-300 text-gray-700">
                  <th className="p-2 border-r border-gray-300 w-12 text-center">SNo</th><th className="p-2 border-r border-gray-300 w-1/3">Item Name</th><th className="p-2 border-r border-gray-300 w-24">Batch No</th>
                  <th className="p-2 border-r border-gray-300 w-20 text-center">Old Tax(%)</th><th className="p-2 border-r border-gray-300 w-20 text-center text-red-500">New Tax(%)</th>
                  <th className="p-2 border-r border-gray-300 w-20 text-center">GrnId</th><th className="p-2 border-r border-gray-300 w-16 text-center">Qty</th>
                  <th className="p-2 border-r border-gray-300 w-24 text-center">MRP (₹)</th><th className="p-2 border-r border-gray-300 w-28 text-center">Amount (₹)</th><th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="p-2 border-r border-gray-300 text-center">{index + 1}</td>
                    <td className="p-1 border-r border-gray-300"><input className="w-full p-1 outline-none" placeholder="Enter medicine name" value={item.name} onChange={(e) => handleItemChange(index, 'name', e.target.value)} /></td>
                    <td className="p-1 border-r border-gray-300"><input className="w-full p-1 outline-none bg-gray-50 text-center" value={item.batch} onChange={(e) => handleItemChange(index, 'batch', e.target.value)} /></td>
                    <td className="p-1 border-r border-gray-300"><input className="w-full p-1 outline-none bg-gray-50 text-center" value={item.oldTax} onChange={(e) => handleItemChange(index, 'oldTax', e.target.value)} /></td>
                    <td className="p-1 border-r border-gray-300"><input className="w-full p-1 outline-none bg-gray-50 text-center" value={item.newTax} onChange={(e) => handleItemChange(index, 'newTax', e.target.value)} /></td>
                    <td className="p-1 border-r border-gray-300"><input className="w-full p-1 outline-none bg-gray-50 text-center" value={item.grn} onChange={(e) => handleItemChange(index, 'grn', e.target.value)} /></td>
                    <td className="p-1 border-r border-gray-300"><input type="number" min="0" className="w-full p-1 outline-none text-center border border-transparent focus:border-blue-300" value={item.qty} onChange={(e) => handleItemChange(index, 'qty', e.target.value)} /></td>
                    <td className="p-1 border-r border-gray-300"><input type="number" min="0" className="w-full p-1 outline-none text-center border border-transparent focus:border-blue-300" value={item.mrp} onChange={(e) => handleItemChange(index, 'mrp', e.target.value)} /></td>
                    <td className="p-1 border-r border-gray-300"><input className="w-full p-1 outline-none bg-gray-50 text-right" value={rowAmount(item).toFixed(2)} readOnly /></td>
                    <td className="p-1 text-center"><button type="button" onClick={() => removeItem(index)} className="text-blue-500 hover:text-red-500"><X size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div className="bg-white border border-gray-300 rounded-sm mb-4">
        <div className="bg-[#4da3d9] text-white px-4 py-2 font-semibold">Payment Details</div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div><label className="text-gray-600 font-semibold">Total Amount(₹)</label><input className={readonlyField} value={totals.total} readOnly /></div>
          <div><label className="text-gray-600 font-semibold">Discount(%)</label><input type="number" min="0" max="100" className={field} value={payment.discountPercent} onChange={(e) => handlePaymentChange('discountPercent', e.target.value)} /></div>
          <div><label className="text-gray-600 font-semibold">Discount Amount</label><input className={readonlyField} value={totals.discountAmount} readOnly /></div>
          <div><label className="text-gray-600 font-semibold">Net Amount(₹)</label><input className={`${readonlyField} font-bold`} value={totals.net} readOnly /></div>
          <div>
            <label className="text-red-500 font-semibold">* Payment Mode</label>
            <select className={field} value={payment.mode} onChange={(e) => handlePaymentChange('mode', e.target.value)}>
              <option>Cash</option><option>Card</option><option>UPI</option><option>Insurance</option><option>Credit</option>
            </select>
          </div>
          <div><label className="text-red-500 font-semibold">* Paid Amount</label><input type="number" min="0" className={field} value={payment.paid} onChange={(e) => handlePaymentChange('paid', e.target.value)} /></div>
          <div><label className="text-red-500 font-semibold">* Due Amount</label><input className={readonlyField} value={totals.due} readOnly /></div>
          <div><label className="text-red-500 font-semibold">* Remarks</label><input className={field} value={payment.remarks} onChange={(e) => handlePaymentChange('remarks', e.target.value)} /></div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-4 mt-6 mb-10">
        <button type="button" onClick={() => handleSubmit(true)} disabled={isSubmitting} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-sm font-semibold hover:bg-gray-300 disabled:opacity-50">Save as Draft</button>
        <button type="button" onClick={() => handleSubmit(false)} disabled={isSubmitting} className="bg-[#1a4f76] text-white px-8 py-2 rounded-sm font-semibold hover:bg-[#153f5e] disabled:opacity-50">{isSubmitting ? 'Submitting...' : 'SUBMIT'}</button>
        <button type="button" onClick={resetForm} className="bg-[#e5b75d] text-white px-6 py-2 rounded-sm font-semibold hover:bg-[#d1a24a]">Clear</button>
      </div>

      {/* IP Patient Modal */}
      <Modal open={isModalOpen} onClose={closeModal}>
        <div className="px-10 pt-8 pb-6">
          <div className="flex items-center justify-end gap-3 mb-4">
            <label className="text-sm font-semibold text-gray-800">Search:</label>
            <input type="text" autoFocus placeholder="Name, IP No, MR No, mobile" className="w-64 rounded-sm border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#4da3d9]" value={modalSearch} onChange={(e) => { setModalSearch(e.target.value); setModalPage(1) }} />
          </div>
          <div className="max-h-[55vh] overflow-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0">
                <tr>{['MR Number', 'Patient Reg No.', 'Name', 'Gender', 'Age', 'Phone'].map((h) => <th key={h} className="bg-[#4da3d9] px-4 py-3 font-semibold text-white">{h}</th>)}</tr>
              </thead>
              <tbody>
                {loadingModal ? (
                  <tr><td colSpan="6" className="py-8 text-center text-gray-500">Loading IP patients...</td></tr>
                ) : modalError ? (
                  <tr><td colSpan="6" className="py-8 text-center text-red-600">{modalError}</td></tr>
                ) : pagedPatients.length === 0 ? (
                  <tr><td colSpan="6" className="py-8 text-center text-gray-500">No IP patients found.</td></tr>
                ) : (
                  pagedPatients.map((pt, idx) => (
                    <tr key={pt.id ?? idx} onClick={() => handleSelectPatient(pt)} className="cursor-pointer odd:bg-white even:bg-gray-50 hover:bg-blue-50">
                      <td className="px-4 py-3">{pt.mr_number || 'N/A'}</td>
                      <td className="px-4 py-3">{pt.ip_reg_no}</td>
                      <td className="px-4 py-3 uppercase">{pt.name}</td>
                      <td className="px-4 py-3">{pt.gender}</td>
                      <td className="px-4 py-3">{pt.age ? `${pt.age}Y` : ''}</td>
                      <td className="px-4 py-3">{pt.mobile}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pager page={modalPage} setPage={setModalPage} total={filteredPatients.length} />
        </div>
      </Modal>

      {/* Item / Drug Combination Modal */}
      <Modal open={isDrugComboOpen} onClose={closeComboModal} width="max-w-5xl">
        <div className="px-10 pt-8 pb-6">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-800">Item Name :</label>
              <input type="text" autoFocus className="w-48 rounded-sm border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-[#4da3d9]" value={comboSearch} onChange={(e) => { setComboSearch(e.target.value); setComboPage(1) }} />
            </div>
          </div>
          <div className="max-h-[55vh] overflow-auto border border-gray-200">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="sticky top-0">
                <tr>
                  <th className="bg-[#4da3d9] px-4 py-2 font-semibold text-white border-r border-white/30">Item Name</th>
                  <th className="bg-[#4da3d9] px-4 py-2 font-semibold text-white border-r border-white/30">Drug Combination</th>
                  <th className="bg-[#4da3d9] px-4 py-2 font-semibold text-white w-24 text-center">Qty</th>
                </tr>
              </thead>
              <tbody>
                {loadingCombo ? (
                  <tr><td colSpan="3" className="py-8 text-center text-gray-500">Loading items...</td></tr>
                ) : comboError ? (
                  <tr><td colSpan="3" className="py-8 text-center text-red-600">{comboError}</td></tr>
                ) : pagedCombos.length === 0 ? (
                  <tr><td colSpan="3" className="py-8 text-center text-gray-500">No items found.</td></tr>
                ) : (
                  pagedCombos.map((drug, idx) => (
                    <tr key={drug.id ?? idx} onClick={() => handleSelectDrug(drug)} className="cursor-pointer border-b border-gray-200 hover:bg-blue-50 odd:bg-white even:bg-gray-50">
                      <td className="px-4 py-2 text-gray-800">{drug.item_name}</td>
                      <td className="px-4 py-2 text-gray-600">{drug.drug_combination}</td>
                      <td className="px-4 py-2 text-center text-gray-800 font-semibold">{drug.qty}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pager page={comboPage} setPage={setComboPage} total={filteredCombos.length} />
        </div>
      </Modal>

      {/* Drafts Modal */}
      <Modal open={isDraftOpen} onClose={() => setIsDraftOpen(false)} width="max-w-2xl">
        <div className="px-8 pt-8 pb-6">
          <h3 className="mb-4 text-base font-semibold text-gray-800">Sale drafts for {patient.name || 'patient'}</h3>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr>{['Sale No', 'Total (₹)', 'Net (₹)', 'Created'].map((h) => <th key={h} className="bg-[#4da3d9] px-4 py-3 font-semibold text-white">{h}</th>)}</tr>
            </thead>
            <tbody>
              {loadingDrafts ? (
                <tr><td colSpan="4" className="py-8 text-center text-gray-500">Loading...</td></tr>
              ) : drafts.length === 0 ? (
                <tr><td colSpan="4" className="py-8 text-center text-gray-500">No drafts for this patient.</td></tr>
              ) : (
                drafts.map((d) => (
                  <tr key={d.id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-4 py-3">{d.sale_no}</td>
                    <td className="px-4 py-3">{d.total_amount}</td>
                    <td className="px-4 py-3">{d.net_amount}</td>
                    <td className="px-4 py-3">{d.created_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  )
}