import { useEffect, useState, useRef } from 'react'
import { Search, Plus, X, AlertCircle, Save } from 'lucide-react'
import api from '../../api/axios'

// ---------- Filter helpers ----------
const fmtDate = (d) => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const getDateRange = (filter, customFrom, customTo) => {
  const today = new Date()
  switch (filter) {
    case 'today':
      return { from: fmtDate(today), to: fmtDate(today) }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { from: fmtDate(y), to: fmtDate(y) }
    }
    case 'week': {
      const start = new Date(today)
      const day = start.getDay() // 0 = Sun
      const diff = day === 0 ? 6 : day - 1 // Monday start
      start.setDate(start.getDate() - diff)
      return { from: fmtDate(start), to: fmtDate(today) }
    }
    case 'month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: fmtDate(start), to: fmtDate(today) }
    }
    case 'custom':
      return { from: customFrom, to: customTo }
    default:
      return { from: '', to: '' }
  }
}

const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom Range' },
]

export default function IPLab() {
  // ---------- entry-form state ----------
  const [searchQuery, setSearchQuery] = useState('')
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [admission, setAdmission] = useState(null)

  const [labItems, setLabItems] = useState([])
  const [catalog, setCatalog] = useState([])
  const [filteredCatalog, setFilteredCatalog] = useState([])
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')

  const [discountPercent, setDiscountPercent] = useState('0')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [paidAmount, setPaidAmount] = useState('0')
  const [discountComments, setDiscountComments] = useState('NA')
  const [paymode, setPaymode] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ---------- filter + records state ----------
  const [activeFilter, setActiveFilter] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [records, setRecords] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsError, setRecordsError] = useState('')
  const [recordsSearch, setRecordsSearch] = useState('')

  // debounce ref for records search
  const searchDebounce = useRef(null)

  const totalCharges = labItems.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const subTotal = totalCharges - (Number(discountAmount) || 0)
  const balanceNetPay = subTotal - (Number(paidAmount) || 0)
  const hasSavedItems = labItems.some(item => item.isSaved === true)

  // ---------- patient/catalog logic ----------
  const searchPatients = async (q) => {
    if (!q.trim()) { setPatients([]); return }
    try {
      const { data } = await api.get('/patients', { params: { search: q, limit: 10 } })
      setPatients(data)
    } catch (err) { console.error('Patient search failed:', err) }
  }

  const fetchCatalog = async () => {
    try {
      const { data } = await api.get('/ip-lab/catalog')
      setCatalog(data || [])
    } catch (err) { console.error('Failed to load catalog:', err) }
  }

  const fetchAdmission = async (patientId) => {
    try {
      const { data: admissions } = await api.get('/ip-registrations', {
        params: { patient_id: patientId, status: 'Admitted' }
      })
      const list = Array.isArray(admissions) ? admissions : (admissions?.data || [])
      if (list.length > 0) {
        setAdmission(list[0])
        loadExistingLabItems(list[0].id)
      } else {
        setError('Patient has no active IP admission')
      }
    } catch (err) { console.error('Failed to fetch admission:', err) }
  }

  const loadExistingLabItems = async (admId) => {
    try {
      const { data } = await api.get(`/ip-lab/by-admission/${admId}`)
      if (data.items && data.items.length > 0) {
        setLabItems(data.items.map(i => ({
          id: i.id,
          item_name: i.item_name,
          quantity: Number(i.quantity),
          rate: Number(i.rate),
          amount: Number(i.amount),
          isSaved: true,
        })))
      } else {
        setLabItems([])
      }
      if (data.payment) {
        setDiscountPercent(String(data.payment.discount_percent || '0'))
        setDiscountAmount(String(data.payment.discount_amount || '0'))
        setPaidAmount(String(data.payment.paid_amount || '0'))
        setDiscountComments(data.payment.discount_comments || 'NA')
        setPaymode(data.payment.paymode || '')
      } else {
        resetPaymentFields()
      }
    } catch (err) { console.error('Failed to load existing items:', err) }
  }

  useEffect(() => { fetchCatalog() }, [])

  // ---------- records fetch ----------
  const fetchRecords = async (filter = activeFilter, overrideSearch) => {
    const term = overrideSearch !== undefined ? overrideSearch : recordsSearch
    const { from, to } = getDateRange(filter, customFrom, customTo)
    if (filter === 'custom' && (!from || !to)) {
      setRecordsError('Please select both From and To dates')
      return
    }
    if (from && to && from > to) {
      setRecordsError('From date cannot be later than To date')
      return
    }
    setRecordsLoading(true)
    setRecordsError('')
    try {
      const { data } = await api.get('/ip-lab', {
        params: {
          start_date: from || undefined,
          end_date: to || undefined,
          search: term?.trim() || undefined,
          grouped: 1,
        },
      })
      setRecords(Array.isArray(data) ? data : (data?.data || []))
    } catch (err) {
      console.error('fetchRecords error:', err?.response?.status, err?.response?.data || err.message)
      setRecordsError(
        err?.response?.data?.error ||
        `Failed to load lab records (${err?.response?.status || 'network'})`
      )
    } finally {
      setRecordsLoading(false)
    }
  }

  // Initial load
  useEffect(() => { fetchRecords('today') }, [])

  // Cleanup debounce timer
  useEffect(() => () => clearTimeout(searchDebounce.current), [])

  const handleFilterClick = (f) => {
    setActiveFilter(f)
    if (f !== 'custom') fetchRecords(f)
  }

  const applyCustom = () => fetchRecords('custom')

  // ---------- entry-form handlers ----------
  const selectPatient = async (patient) => {
    setSelectedPatient(patient)
    setSearchQuery(`${patient.name} — ${patient.phone}`)
    setPatients([])
    setError('')
    setSuccess('')
    setLabItems([])
    resetPaymentFields()
    await fetchAdmission(patient.id)
  }

  const resetPatient = () => {
    setSelectedPatient(null)
    setAdmission(null)
    setSearchQuery('')
    setLabItems([])
    resetPaymentFields()
  }

  const resetPaymentFields = () => {
    setDiscountPercent('0')
    setDiscountAmount('0')
    setPaidAmount('0')
    setDiscountComments('NA')
    setPaymode('')
  }

  const handleCatalogSearch = (e) => {
    const q = e.target.value.toLowerCase()
    setCatalogSearch(e.target.value)
    setFilteredCatalog(q ? catalog.filter(c => (c.name || '').toLowerCase().includes(q)) : catalog)
    setShowCatalogDropdown(true)
  }

  const addLabItem = (item) => {
    const rate = Number(item.rate) || 0
    setLabItems(prev => [...prev, {
      id: Date.now(),
      item_name: item.name,
      quantity: 1,
      rate,
      amount: rate,
      isSaved: false,
    }])
    setCatalogSearch('')
    setShowCatalogDropdown(false)
  }

  const removeLabItem = (id) => setLabItems(prev => prev.filter(x => x.id !== id))

  const handleDiscountPercentChange = (val) => {
    setDiscountPercent(val)
    setDiscountAmount(((totalCharges * (parseFloat(val) || 0)) / 100).toFixed(2))
  }

  const handleDiscountAmountChange = (val) => {
    setDiscountAmount(val)
    setDiscountPercent(totalCharges > 0 ? (((parseFloat(val) || 0) / totalCharges) * 100).toFixed(2) : '0')
  }

  const handleSaveLab = async () => {
    if (!admission) return setError('No active IP admission for this patient')
    if (labItems.length === 0) return setError('Add at least one lab test first')
    if (hasSavedItems) {
      setError('You have already saved this data. To add more items, click "Change Patient" and re-select, or delete items first.')
      return
    }
    setLoading(true); setError(''); setSuccess('')
    try {
      await api.post('/ip-lab', {
        ip_registration_id: admission.id,
        items: labItems.map(i => ({ item_name: i.item_name, quantity: i.quantity, rate: i.rate, amount: i.amount })),
        total_amount: totalCharges,
        discount_percent: parseFloat(discountPercent) || 0,
        discount_amount: parseFloat(discountAmount) || 0,
        paid_amount: parseFloat(paidAmount) || 0,
        balance_amount: balanceNetPay,
        discount_comments: discountComments,
        paymode,
      })
      setSuccess('Lab tests saved successfully!')
      loadExistingLabItems(admission.id)
      fetchRecords(activeFilter)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save lab tests')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">

      {/* ============ FILTER BAR ============ */}
      <div className="bg-white p-3 border border-border rounded-sm shadow-sm flex flex-wrap items-center gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => handleFilterClick(f.key)}
            className={`px-3 py-1.5 text-sm rounded-sm border ${
              activeFilter === f.key
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-gray-700 border-border hover:bg-teal-50'
            }`}
          >
            {f.label}
          </button>
        ))}

        {activeFilter === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="border border-border rounded-sm px-2 py-1 text-sm"
            />
            <span className="text-gray-500 text-sm">to</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="border border-border rounded-sm px-2 py-1 text-sm"
            />
            <button
              onClick={applyCustom}
              className="bg-[#00bcd4] hover:bg-[#00a5bb] text-white px-3 py-1 rounded-sm text-sm"
            >
              Apply
            </button>
          </div>
        )}

        {/* Records search */}
        <div className="flex items-center border border-border rounded-sm bg-white px-2 py-1 ml-auto">
          <Search size={16} className="text-gray-400 mr-1.5" />
          <input
            className="outline-none text-sm w-48"
            placeholder="Search records…"
            value={recordsSearch}
            onChange={e => {
              const v = e.target.value
              setRecordsSearch(v)
              clearTimeout(searchDebounce.current)
              searchDebounce.current = setTimeout(() => {
                fetchRecords(activeFilter, v)
              }, 350)
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                clearTimeout(searchDebounce.current)
                fetchRecords(activeFilter, recordsSearch)
              }
            }}
          />
          {recordsSearch && (
            <button
              onClick={() => {
                clearTimeout(searchDebounce.current)
                setRecordsSearch('')
                fetchRecords(activeFilter, '')
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ============ RECORDS TABLE ============ */}
      <div className="border border-border bg-white rounded-sm">
        <div className="bg-gray-100 px-4 py-2 border-b border-border">
          <h2 className="font-semibold text-teal-800 text-sm">
            📋 Lab Records — {FILTERS.find(f => f.key === activeFilter)?.label}
            {recordsSearch && <span className="text-gray-500 font-normal"> · "{recordsSearch}"</span>}
          </h2>
        </div>
        <div className="overflow-x-auto">
          {recordsLoading ? (
            <div className="py-6 text-center text-sm text-gray-500">Loading…</div>
          ) : recordsError ? (
            <div className="py-6 text-center text-sm text-red-600 flex items-center justify-center gap-2">
              <AlertCircle size={16} /> {recordsError}
            </div>
          ) : records.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500">
              No lab records found for the selected period.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">IP Reg No</th>
                  <th className="px-3 py-2 text-left">Patient</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-center">Tests</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Discount</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-center">Paymode</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.ip_registration_id} className="border-b border-border last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 font-medium text-teal-700">{r.ip_reg_no}</td>
                    <td className="px-3 py-2">{r.patient_name}</td>
                    <td className="px-3 py-2">{r.phone || '—'}</td>
                    <td className="px-3 py-2 text-center">{r.items_count ?? 0}</td>
                    <td className="px-3 py-2 text-right">₹{Number(r.total_amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">₹{Number(r.discount_amount || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">₹{Number(r.paid_amount || 0).toFixed(2)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${
                      Number(r.balance_amount || 0) > 0 ? 'text-red-500' : 'text-green-600'
                    }`}>
                      ₹{Number(r.balance_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">{r.paymode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ============ ENTRY FORM ============ */}
      {!selectedPatient && (
        <div className="bg-white p-6 border border-border rounded-sm shadow-sm">
          <label className="label font-semibold text-lg mb-2 block">Search Patient to Add IP Lab Tests</label>
          <div className="relative max-w-xl">
            <div className="flex items-center border border-border rounded-sm bg-white px-3 py-2">
              <Search size={18} className="text-gray-400 mr-2" />
              <input
                className="w-full outline-none text-sm"
                placeholder="Enter name, phone, or MR number..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); searchPatients(e.target.value) }}
              />
            </div>
            {patients.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-sm shadow-lg max-h-60 overflow-y-auto">
                {patients.map(p => (
                  <button key={p.id} onClick={() => selectPatient(p)} className="w-full text-left px-4 py-3 text-sm hover:bg-teal-50 border-b border-border last:border-0">
                    <div className="flex justify-between font-medium"><span>{p.name}</span><span className="text-teal-600">{p.patient_uid}</span></div>
                    <p className="text-xs text-gray-500 mt-1">{p.phone} · {p.gender} · Age {p.age ?? '—'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedPatient && (
        <>
          <div className="border border-border bg-white rounded-sm px-4 py-3 flex justify-between items-center">
            <div>
              <div className="font-semibold text-lg text-teal-800">{selectedPatient.name}</div>
              <div className="text-sm text-gray-600">
                IP Reg: <span className="font-medium text-gray-800">{admission?.ip_reg_no || 'N/A'}</span> ·
                Phone: {selectedPatient.phone}
              </div>
            </div>
            <button onClick={resetPatient} className="text-xs text-red-500 hover:underline">Change Patient</button>
          </div>

          <div className="border border-border bg-white rounded-sm">
            <div className="bg-gray-100 px-4 py-2 border-b border-border">
              <h2 className="font-semibold text-teal-800 flex items-center gap-2 text-sm"><span className="text-lg">🔬</span> Lab-Details</h2>
            </div>
            <div className="p-4">
              <div className="flex gap-2 mb-4">
                <button type="button" onClick={() => { setFilteredCatalog(catalog); setShowCatalogDropdown(true) }} className="bg-[#00bcd4] hover:bg-[#00a5bb] text-white px-4 py-1.5 rounded-sm text-sm font-medium flex items-center gap-1 shadow-sm">
                  <Plus size={16} /> Add Lab Test
                </button>
              </div>

              {showCatalogDropdown && (
                <div className="relative mb-4 max-w-md">
                  <input autoFocus className="w-full border border-teal-400 rounded-sm px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="Type to search test…" value={catalogSearch} onChange={handleCatalogSearch} onBlur={() => setTimeout(() => setShowCatalogDropdown(false), 200)} />
                  <div className="absolute z-50 w-full mt-1 bg-white border border-border shadow-lg max-h-60 overflow-y-auto">
                    {filteredCatalog.length === 0 ? <div className="px-3 py-2 text-sm text-gray-500">No tests found</div> : filteredCatalog.map(item => (
                      <div key={item.id} onMouseDown={(e) => e.preventDefault()} onClick={() => addLabItem(item)} className="px-3 py-2 text-sm hover:bg-teal-50 cursor-pointer border-b border-gray-100 last:border-0 flex justify-between">
                        <span>{item.name}</span><span className="text-ink/50">₹{Number(item.rate || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <table className="w-full text-sm border border-border">
                <thead className="bg-gray-50 border-b border-border">
                  <tr><th className="px-3 py-2 text-left w-16">S.No</th><th className="px-3 py-2 text-left">Lab Test</th><th className="px-3 py-2 text-right w-32">Cost (₹)</th><th className="px-3 py-2 text-center w-16">Action</th></tr>
                </thead>
                <tbody>
                  {labItems.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-6 text-gray-400">No tests added. Click "Add Lab Test" to begin.</td></tr>
                  ) : labItems.map((item, idx) => (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2">{idx + 1}</td><td className="px-3 py-2">{item.item_name}</td><td className="px-3 py-2 text-right">{Number(item.amount || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-center"><button type="button" onClick={() => removeLabItem(item.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-sm"><X size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-border bg-white rounded-sm">
            <div className="bg-gray-100 px-4 py-2 border-b border-border"><h2 className="font-semibold text-teal-800 flex items-center gap-2 text-sm"><span className="text-lg">💳</span> Payment Details</h2></div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="space-y-4">
                <div className="flex items-center justify-between"><span className="text-gray-700">Total Charges(₹)</span><span className="font-semibold text-blue-600">{totalCharges.toFixed(2)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-700">Sub Total(₹)</span><span className="font-semibold text-blue-600">{subTotal.toFixed(2)}</span></div>
                <div><label className="block text-gray-700 mb-1">*Discount Comments</label><textarea className="w-full border border-border rounded-sm px-2 py-1.5 focus:outline-none focus:border-teal-500" rows="2" value={discountComments} onChange={e => setDiscountComments(e.target.value)} /></div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2"><span className="text-gray-700 w-28">Discount (%)</span><input type="number" min="0" step="any" className="w-full border border-border rounded-sm px-2 py-1" value={discountPercent} onChange={e => handleDiscountPercentChange(e.target.value)} onFocus={e => { if (e.target.value === '0') setDiscountPercent('') }} onBlur={e => { if (e.target.value === '') setDiscountPercent('0') }} /></div>
                <div className="flex items-center justify-between gap-2"><span className="text-gray-700 w-28">*Paid Amount(₹)</span><input type="number" min="0" step="any" className="w-full border border-border rounded-sm px-2 py-1" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} onFocus={e => { if (e.target.value === '0') setPaidAmount('') }} onBlur={e => { if (e.target.value === '') setPaidAmount('0') }} /></div>
                <div className="flex items-center justify-between gap-2"><span className="text-gray-700 w-28">*Paymode</span><select className="w-full border border-border rounded-sm px-2 py-1" value={paymode} onChange={e => setPaymode(e.target.value)}><option value="">Select</option><option value="Cash">Cash</option><option value="Card">Card</option><option value="UPI">UPI</option><option value="Insurance">Insurance</option></select></div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2"><span className="text-gray-700 w-32">Discount Amount(₹)</span><input type="number" min="0" step="any" className="w-full border border-border rounded-sm px-2 py-1" value={discountAmount} onChange={e => handleDiscountAmountChange(e.target.value)} onFocus={e => { if (e.target.value === '0') setDiscountAmount('') }} onBlur={e => { if (e.target.value === '') setDiscountAmount('0') }} /></div>
                <div className="flex items-center justify-between"><span className="text-gray-700 font-medium">Balance Net Pay(₹)</span><span className={`font-bold ${balanceNetPay > 0 ? 'text-red-500' : 'text-green-600'}`}>{balanceNetPay.toFixed(2)}</span></div>
              </div>
            </div>
          </div>

          {error && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-sm px-3 py-2"><AlertCircle size={16} /> {error}</div>}
          {success && <div className="text-sm text-teal-700 bg-teal-50 border border-teal-200 rounded-sm px-3 py-2">{success}</div>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSaveLab}
              disabled={loading || labItems.length === 0 || hasSavedItems}
              className="bg-[#2196f3] hover:bg-[#1976d2] text-white px-6 py-2 rounded-sm text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={15} /> {loading ? 'Saving…' : hasSavedItems ? 'Data Already Saved' : 'Save Lab Tests'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}