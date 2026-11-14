import { useEffect, useMemo, useState } from 'react'
import { Receipt, FlaskConical, Stethoscope, Scissors, Search, X } from 'lucide-react'
import api from '../../api/axios'
import { PageHeader, Section, StatusBadge } from '../../components/PageHeader'
import OPBillingLabTab from '../../components/billing/OPBillingLabTab' 
import OPServices from '../../components/billing/OPServices'
import OPProcedures from '../../components/billing/OPProcedures'
import Pagination from '../../components/common/Pagination'

const CHARGE_ROWS = [
  { key: 'consultation_charge', label: 'Consultation' },
  { key: 'lab_charge', label: 'Lab / Blood Test' },
  { key: 'procedure_charge', label: 'Procedure' },
  { key: 'service_charge', label: 'Service / X-Ray' },
  { key: 'pharmacy_charge', label: 'Pharmacy / Medicine' },
]

const initCharges = {
  consultation_charge: 0,
  lab_charge: 0,
  procedure_charge: 0,
  service_charge: 0,
  pharmacy_charge: 0,
}

const PER_PAGE = 25

const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
]

const fmt = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const getRange = (key, customFrom, customTo) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (key) {
    case 'today':
      return { from: fmt(today), to: fmt(today) }
    case 'yesterday': {
      const y = new Date(today)
      y.setDate(y.getDate() - 1)
      return { from: fmt(y), to: fmt(y) }
    }
    case 'week': {
      const start = new Date(today)
      const diff = (start.getDay() + 6) % 7
      start.setDate(start.getDate() - diff)
      return { from: fmt(start), to: fmt(today) }
    }
    case 'month':
      return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) }
    case 'custom':
      return customFrom && customTo ? { from: customFrom, to: customTo } : null
    default:
      return null
  }
}

export default function OPBilling() {
  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [charges, setCharges] = useState(initCharges)
  const [discount, setDiscount] = useState(0)
  const [paid, setPaid] = useState(0)
  const [paymentMode, setPaymentMode] = useState('Cash')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('bills')

  const [opRegistration, setOpRegistration] = useState(null)

  const [activeFilter, setActiveFilter] = useState('')
  const [customFrom, setCustomFrom] = useState(fmt(new Date()))
  const [customTo, setCustomTo] = useState(fmt(new Date()))
  const [showModal, setShowModal] = useState(false)
  const [modalPatients, setModalPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(false)

  const [bills, setBills] = useState([])
  const [billsLoading, setBillsLoading] = useState(false)
  const [billSearch, setBillSearch] = useState('')
  const [billStartDate, setBillStartDate] = useState('')
  const [billEndDate, setBillEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const loadBills = (opts = {}) => {
    const p = opts.page ?? page
    setBillsLoading(true)
    api.get('/op-billing', {
      params: {
        search: billSearch || undefined,
        start_date: billStartDate || undefined,
        end_date: billEndDate || undefined,
        page: p,
        per_page: PER_PAGE,
      },
    })
      .then((r) => {
        setBills(r.data.data || [])
        setTotal(r.data.total || 0)
        setTotalPages(r.data.total_pages || 1)
        setPage(r.data.page || p)
      })
      .catch((err) => console.error('Failed to load OP bills:', err))
      .finally(() => setBillsLoading(false))
  }

  useEffect(() => {
    loadBills({ page: 1 })
  }, [])

  const applyBillFilters = () => loadBills({ page: 1 })

  const resetBillFilters = () => {
    setBillSearch('')
    setBillStartDate('')
    setBillEndDate('')
    setPage(1)
    setTimeout(() => loadBills({ page: 1 }), 0)
  }

  useEffect(() => {
    if (patientId) return
    if (patientSearch.length > 1) {
      api.get('/patients', { params: { search: patientSearch } })
        .then((r) => setPatients(r.data))
        .catch(() => setPatients([]))
    } else {
      setPatients([])
    }
  }, [patientSearch, patientId])

  useEffect(() => {
    if (!patientId) {
      setOpRegistration(null)
      return
    }
    
    api.get('/op-registrations', { params: { patient_id: patientId, status: 'Active' } })
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.data || [])
        setOpRegistration(list[0] || null)
      })
      .catch(() => {
        api.get('/op-registrations', { params: { patient_id: patientId } })
          .then((r) => {
            const list = Array.isArray(r.data) ? r.data : (r.data?.data || [])
            setOpRegistration(list[0] || null)
          })
          .catch(() => setOpRegistration(null))
      })
  }, [patientId])

  // Auto-fill the Lab / Blood Test charge from saved lab tests
  useEffect(() => {
    if (!opRegistration?.id) return
    let cancelled = false
    api.get(`/op-lab/by-registration/${opRegistration.id}`)
      .then((r) => {
        if (cancelled) return
        const labTotal = (r.data?.items || []).reduce((s, i) => s + (Number(i.amount) || 0), 0)
        setCharges((c) => ({ ...c, lab_charge: labTotal }))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [opRegistration])

  useEffect(() => {
    if (!showModal) return
    const range = getRange(activeFilter, customFrom, customTo)
    if (!range) {
      setModalPatients([])
      return
    }

    let cancelled = false
    setLoadingPatients(true)
    api
      .get('/patients', { params: { from_date: range.from, to_date: range.to, limit: 200 } })
      .then((r) => { if (!cancelled) setModalPatients(r.data || []) })
      .catch(() => { if (!cancelled) setModalPatients([]) })
      .finally(() => { if (!cancelled) setLoadingPatients(false) })

    return () => { cancelled = true }
  }, [showModal, activeFilter, customFrom, customTo])

  const gross = useMemo(() => {
    return Object.values(charges).reduce((sum, value) => sum + Number(value || 0), 0)
  }, [charges])

  const netTotal = Math.max(0, gross - Number(discount || 0))
  const due = Math.max(0, netTotal - Number(paid || 0))

  const rangeLabel = (() => {
    const r = getRange(activeFilter, customFrom, customTo)
    if (!r) return ''
    return r.from === r.to ? r.from : `${r.from} → ${r.to}`
  })()

  const pickFilter = (key) => {
    setActiveFilter(key)
    setShowModal(true)
  }

  const selectPatient = (p) => {
    setSelectedPatient(p)
    setPatientId(p.id)
    setPatientSearch(`${p.name} (${p.patient_uid})`)
    setPatients([])
    setError('')
    setShowModal(false)
    setCharges(initCharges)
    setDiscount(0)
    setPaid(0)
  }

  const handleSearchChange = (e) => {
    setPatientSearch(e.target.value)
    if (patientId) {
      setPatientId('')
      setSelectedPatient(null)
      setOpRegistration(null)
      setCharges(initCharges)
      setDiscount(0)
      setPaid(0)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!patientId) return setError('Select a patient first')
    setError('')
    setSaving(true)
    try {
      await api.post('/op-billing', {
        patient_id: patientId,
        op_registration_id: opRegistration?.id,
        ...charges,
        discount,
        paid_amount: paid,
        payment_mode: paymentMode,
      })
      setPatientId('')
      setSelectedPatient(null)
      setOpRegistration(null)
      setPatientSearch('')
      setPatients([])
      setCharges(initCharges)
      setDiscount(0)
      setPaid(0)
      setPaymentMode('Cash')
      loadBills({ page: 1 })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create bill')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title="Outpatient Billing" subtitle="Create and manage OP bills" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        
        <form onSubmit={submit} className="xl:col-span-1">
          <Section title="New OP Bill">
            {error && <p className="text-sm text-danger-500 mb-3">{error}</p>}

            <label className="label">Registered Patients</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {FILTERS.map((f) => (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => pickFilter(f.key)}
                  className={`text-xs px-3 py-1.5 rounded-sm border ${activeFilter === f.key ? 'bg-teal-600 text-white border-teal-600' : 'border-border text-ink/60 hover:bg-teal-50'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <label className="label">Patient</label>
            <input
              className="input mb-1"
              placeholder="Search name or phone…"
              value={patientSearch}
              onChange={handleSearchChange}
            />
            {patients.length > 0 && (
              <div className="border border-border rounded-sm mb-3 max-h-40 overflow-y-auto">
                {patients.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 border-b border-border last:border-0"
                  >
                    {p.name} · {p.phone}
                  </button>
                ))}
              </div>
            )}

            {selectedPatient && (
              <div className="border border-teal-600/30 bg-teal-50 rounded-sm px-3 py-2 mb-3 text-xs text-ink/70">
                <div className="font-medium text-sm text-ink">{selectedPatient.name}</div>
                <div>
                  {selectedPatient.patient_uid}
                  {opRegistration?.opd_reg_no ? ` · ${opRegistration.opd_reg_no}` : ''}
                  {selectedPatient.age != null ? ` · ${selectedPatient.age} yrs` : ''}
                  {selectedPatient.gender ? ` · ${selectedPatient.gender}` : ''}
                </div>
                <div>{selectedPatient.phone}</div>
              </div>
            )}

            <div className="space-y-2 my-3">
              {CHARGE_ROWS.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink/70">{c.label}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input w-28 text-right"
                    value={charges[c.key]}
                    onChange={(e) =>
                      setCharges((current) => ({ ...current, [c.key]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mb-3">
              <label className="label">Discount</label>
              <input type="number" min="0" step="0.01" className="input" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>

            <div className="bg-teal-50 rounded-sm p-3 text-sm space-y-1 mb-3">
              <div className="flex justify-between"><span>Gross Total</span><span>₹{gross.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>₹{Number(discount || 0).toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold"><span>Net Total</span><span>₹{netTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-danger-500"><span>Due</span><span>₹{due.toFixed(2)}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Paid</label>
                <input type="number" min="0" step="0.01" className="input" value={paid} onChange={(e) => setPaid(e.target.value)} />
              </div>
              <div>
                <label className="label">Payment Mode</label>
                <select className="input" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                  {['Cash', 'Card', 'UPI', 'Insurance', 'Credit'].map((mode) => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
              <Receipt size={15} /> {saving ? 'Generating…' : 'Generate Bill'}
            </button>
          </Section>
        </form>

        <div className="xl:col-span-2">
          <Section title="OP Records">
            <div className="flex border-b border-border mb-4">
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'bills' ? 'text-teal-700 border-b-2 border-teal-700' : 'text-ink/50 hover:text-ink'
                }`}
                onClick={() => setActiveTab('bills')}
              >
                <Receipt size={14} className="inline mr-1" /> OP Bills
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'lab' ? 'text-teal-700 border-b-2 border-teal-700' : 'text-ink/50 hover:text-ink'
                }`}
                onClick={() => setActiveTab('lab')}
              >
                <FlaskConical size={14} className="inline mr-1" /> Lab
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'services' ? 'text-teal-700 border-b-2 border-teal-700' : 'text-ink/50 hover:text-ink'
                }`}
                onClick={() => setActiveTab('services')}
              >
                <Stethoscope size={14} className="inline mr-1" /> Services
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'procedures' ? 'text-teal-700 border-b-2 border-teal-700' : 'text-ink/50 hover:text-ink'
                }`}
                onClick={() => setActiveTab('procedures')}
              >
                <Scissors size={14} className="inline mr-1" /> Procedures
              </button>
            </div>

            <div>
              {activeTab === 'bills' && (
                <div>
                  <div className="flex flex-wrap gap-3 items-end mb-4">
                    <div className="flex-1 min-w-[220px]">
                      <label className="label">Search (Reg No / Name / Phone / Bill No)</label>
                      <input
                        className="input w-full"
                        placeholder="Search…"
                        value={billSearch}
                        onChange={(e) => setBillSearch(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">From</label>
                      <input type="date" className="input" value={billStartDate} onChange={(e) => setBillStartDate(e.target.value)} />
                    </div>
                    <div>
                      <label className="label">To</label>
                      <input type="date" className="input" value={billEndDate} onChange={(e) => setBillEndDate(e.target.value)} />
                    </div>
                    <button type="button" onClick={applyBillFilters} className="btn-primary flex items-center gap-2">
                      <Search size={16} /> Apply
                    </button>
                    <button type="button" onClick={resetBillFilters} className="btn-secondary">Reset</button>
                  </div>

                  {billsLoading && <div className="text-center py-4">Loading...</div>}

                  {!billsLoading && (
                    <div className="overflow-x-auto">
                      <table className="table-base">
                        <thead>
                          <tr>
                            <th>Bill No</th><th>Reg No</th><th>Patient</th><th>Phone</th>
                            <th>Net Total</th><th>Paid</th><th>Due</th><th>Mode</th><th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bills.map((b) => (
                            <tr key={b.id}>
                              <td>{b.bill_no}</td>
                              <td>{b.opd_reg_no || '—'}</td>
                              <td>{b.patient_name}</td>
                              <td>{b.patient_phone}</td>
                              <td>₹{Number(b.net_total || 0).toFixed(2)}</td>
                              <td>₹{Number(b.paid_amount || 0).toFixed(2)}</td>
                              <td>₹{Number(b.due_amount || 0).toFixed(2)}</td>
                              <td>{b.payment_mode}</td>
                              <td><StatusBadge status={b.status} /></td>
                            </tr>
                          ))}
                          {!bills.length && <tr><td colSpan={9} className="text-center text-ink/40 py-8">No OP bills yet</td></tr>}
                        </tbody>
                      </table>
                      <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={total}
                        perPage={PER_PAGE}
                        onPageChange={(p) => loadBills({ page: p })}
                      />
                    </div>
                  )}
                </div>
              )}
              
              {/* Passing registration to the Lab Tab */}
              {activeTab === 'lab' && <OPBillingLabTab patient={selectedPatient} registration={opRegistration} />}
              
              {activeTab === 'services' && <OPServices />}
              {activeTab === 'procedures' && <OPProcedures />}
            </div>
          </Section>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-md shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div>
                <h3 className="font-semibold text-sm">
                  Registered Patients · {FILTERS.find((f) => f.key === activeFilter)?.label}
                </h3>
                <p className="text-xs text-ink/50">
                  {loadingPatients
                    ? 'Loading…'
                    : `${modalPatients.length} patient${modalPatients.length === 1 ? '' : 's'}${rangeLabel ? ` (${rangeLabel})` : ''}`}
                </p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-ink/50 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 px-4 pt-3">
              {FILTERS.map((f) => (
                <button
                  type="button"
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`text-xs px-3 py-1.5 rounded-sm border ${activeFilter === f.key ? 'bg-teal-600 text-white border-teal-600' : 'border-border text-ink/60 hover:bg-teal-50'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {activeFilter === 'custom' && (
              <div className="grid grid-cols-2 gap-3 px-4 pt-3">
                <div>
                  <label className="label">Start Date</label>
                  <input
                    type="date"
                    className="input"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={(e) => setCustomFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">End Date</label>
                  <input
                    type="date"
                    className="input"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={(e) => setCustomTo(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="p-4 overflow-y-auto">
              {!loadingPatients && modalPatients.length === 0 ? (
                <p className="text-sm text-ink/40 text-center py-8">No patients found for this period</p>
              ) : (
                <div className="border border-border rounded-sm">
                  {modalPatients.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => selectPatient(p)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 border-b border-border last:border-0"
                    >
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-ink/60">
                        {p.patient_uid} · {p.phone}
                        {p.age != null ? ` · ${p.age} yrs` : ''}
                        {p.gender ? ` · ${p.gender}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}