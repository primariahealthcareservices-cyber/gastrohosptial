import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import api from '../../api/axios'
import { PageHeader, Section } from '../../components/PageHeader'
import ItemLineTable, { emptyLine } from '../../components/pharmacy/ItemLineTable'

export default function OutpatientSales() {
  const [saleKind, setSaleKind] = useState('OP') // 'OP' | 'Direct'
  const [patient, setPatient] = useState(null)
  const [mobile, setMobile] = useState('')
  const [name, setName] = useState('')
  const [ageGender, setAgeGender] = useState('')
  const [stores, setStores] = useState([])
  const [storeId, setStoreId] = useState('')
  const [barcode, setBarcode] = useState('')
  const [lines, setLines] = useState([emptyLine()])
  const [discountPercent, setDiscountPercent] = useState(0)
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [paid, setPaid] = useState(0)
  const [remarks, setRemarks] = useState('NA')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(null)

  // Modal State
  const [showPatientModal, setShowPatientModal] = useState(false)

  useEffect(() => {
    api.get('/pharmacy-items/stores').then((r) => {
      setStores(r.data)
      if (r.data.length) setStoreId(r.data[0].id)
    })
  }, [])

  const handleSelectPatient = (p) => {
    setPatient(p)
    setName(p.name)
    setMobile(p.mobile)
    setAgeGender(`${p.age ?? '—'} / ${p.gender}`)
    setShowPatientModal(false)
  }

  const handleDirectSaleToggle = (kind) => {
    setSaleKind(kind)
    // If switching to Direct, clear out the fetched OP patient data
    if (kind === 'Direct') {
      setPatient(null)
      setName('')
      setMobile('')
      setAgeGender('')
    }
  }

  const total = lines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.mrp || 0), 0)
  const discountAmount = (total * Number(discountPercent || 0)) / 100
  const net = Math.max(0, total - discountAmount)
  const due = Math.max(0, net - Number(paid || 0))

  const submit = async (asDraft) => {
    setError('')
    if (saleKind === 'OP' && !patient) return setError('Select an OP registration first')
    if (saleKind === 'Direct' && (!name || !mobile)) return setError('Patient name and mobile are required for a direct sale')
    setSaving(true)
    try {
      const { data } = await api.post('/pharmacy-sales', {
        sale_type: saleKind === 'OP' ? 'OP' : 'Direct',
        op_registration_id: saleKind === 'OP' ? patient?.id : null,
        store_id: storeId,
        items: lines.filter((l) => l.item_name),
        discount_percent: discountPercent,
        payment_mode: paymentMode,
        paid_amount: paid,
        remarks,
        save_as_draft: asDraft,
      })
      setSaved(data)
      setLines([emptyLine()])
      setPaid(0)
      setDiscountPercent(0)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save sale')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Out Patient Sales Form" />
      {error && <div className="text-sm text-danger-500 bg-danger-400/10 border border-danger-400/30 rounded-sm px-3 py-2 mb-3">{error}</div>}
      {saved && (
        <div className="text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-sm px-3 py-2 mb-3">
          Sale <b>{saved.sale_no}</b> saved — Net ₹{Number(saved.net_amount).toFixed(2)}
        </div>
      )}

      <Section title="Patient Details">
        <div className="flex items-center gap-6 mb-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={saleKind === 'OP'} onChange={() => handleDirectSaleToggle('OP')} /> OP
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" checked={saleKind === 'Direct'} onChange={() => handleDirectSaleToggle('Direct')} /> Direct
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">Patient Reg No {saleKind === 'OP' && '*'}</label>
            <div className="flex gap-1">
              <input 
                className={`input ${saleKind === 'OP' ? 'bg-gray-50 cursor-pointer' : ''}`} 
                readOnly 
                value={patient ? patient.opd_reg_no : ''} 
                placeholder={saleKind === 'OP' ? "Click Search to select patient" : "N/A for Direct Sale"}
                onClick={() => saleKind === 'OP' && setShowPatientModal(true)}
                disabled={saleKind === 'Direct'} 
              />
              <button 
                type="button" 
                className="btn-secondary px-3" 
                onClick={() => setShowPatientModal(true)} 
                disabled={saleKind === 'Direct'}
              >
                <Search size={16} />
              </button>
            </div>
          </div>
          <div><label className="label">Mobile *</label><input className="input" value={mobile} onChange={(e) => setMobile(e.target.value)} readOnly={saleKind === 'OP'} /></div>
          <div><label className="label">Patient Name *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} readOnly={saleKind === 'OP'} /></div>
          <div><label className="label">Age/Gender *</label><input className="input" value={ageGender} onChange={(e) => setAgeGender(e.target.value)} readOnly={saleKind === 'OP'} /></div>
          <div><label className="label">Doctor Name</label><input className="input bg-gray-50" readOnly value={patient?.doctor_name || ''} /></div>
          <div>
            <label className="label">Select Pharmacy Store</label>
            <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="label">Barcode</label><input className="input" placeholder="Scan or enter barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} /></div>
        </div>
      </Section>

      <Section title="Item Details">
        <ItemLineTable lines={lines} setLines={setLines} storeId={storeId} />
      </Section>

      <Section title="Payment Details">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><label className="label">Total Amount(₹)</label><input className="input bg-gray-50" readOnly value={total.toFixed(2)} /></div>
          <div><label className="label">Discount(%)</label><input type="number" className="input" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} /></div>
          <div><label className="label">Discount Amount(₹)</label><input className="input bg-gray-50" readOnly value={discountAmount.toFixed(2)} /></div>
          <div><label className="label">Net Amount(₹)</label><input className="input bg-gray-50" readOnly value={net.toFixed(2)} /></div>
          <div>
            <label className="label">Payment Mode *</label>
            <select className="input" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              {['Cash', 'Card', 'UPI', 'Insurance', 'Credit'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Paid Amount *</label><input type="number" className="input" value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
          <div><label className="label">Due Amount *</label><input className="input bg-gray-50" readOnly value={due.toFixed(2)} /></div>
          <div><label className="label">Remarks *</label><input className="input" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        </div>

        <div className="flex gap-3 mt-4">
          <button type="button" className="btn-secondary" disabled={saving} onClick={() => submit(true)}>Save as Draft</button>
          <button type="button" className="btn-primary" disabled={saving} onClick={() => submit(false)}>{saving ? 'Submitting…' : 'Submit'}</button>
          <button type="button" className="btn-secondary" onClick={() => { setLines([emptyLine()]); setPatient(null); setName(''); setMobile(''); setAgeGender(''); }}>Clear</button>
        </div>
      </Section>

      {showPatientModal && (
        <PatientSearchModal 
          onClose={() => setShowPatientModal(false)} 
          onSelect={handleSelectPatient} 
        />
      )}
    </div>
  )
}

// ============================================================
// Patient Search Modal
// ============================================================
function PatientSearchModal({ onClose, onSelect }) {
  const [search, setSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      // Fetching from OP registrations
      api.get('/op-registrations', { params: { search, page, limit: 10 } })
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
          setPatients(list)
        })
        .catch(() => setPatients([]))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [search, page])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Select Out Patient</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="p-4 border-b border-gray-200 flex justify-end">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Search:</span>
            <input 
              className="border border-gray-300 rounded-sm px-3 py-1.5 w-64 focus:outline-none focus:border-[#5B9BD5]"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="MR No, OP No, or Name..."
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#5B9BD5] text-white sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-medium">MR Number</th>
                <th className="px-4 py-3 font-medium">Patient Reg No.</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Gender</th>
                <th className="px-4 py-3 font-medium">Age</th>
                <th className="px-4 py-3 font-medium">Phone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : patients.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No patients found.</td></tr>
              ) : (
                patients.map((p) => (
                  <tr 
                    key={p.id} 
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => onSelect(p)}
                  >
                    {/* Note: using fallbacks in case your API uses slightly different column names */}
                    <td className="px-4 py-2.5 text-gray-800">{p.mr_number}</td>
                    <td className="px-4 py-2.5 text-gray-800">{p.opd_reg_no || p.op_reg_no}</td>
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5">{p.gender}</td>
                    <td className="px-4 py-2.5">{p.age}</td>
                    <td className="px-4 py-2.5">{p.mobile}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-sm text-gray-600">
          <span>Showing page {page}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-gray-300 rounded-sm bg-white disabled:opacity-50">« Prev</button>
            <button onClick={() => setPage(p => p + 1)} className="px-3 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-100">Next »</button>
          </div>
        </div>
      </div>
    </div>
  )
}