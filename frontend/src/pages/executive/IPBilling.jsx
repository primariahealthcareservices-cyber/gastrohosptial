import { useEffect, useMemo, useState } from 'react'
import { Receipt, FlaskConical, Stethoscope, Scissors, X } from 'lucide-react'
import api from '../../api/axios'
import {
  PageHeader,
  Section,
  StatusBadge,
} from '../../components/PageHeader'
import RoomChargeModal from '../../components/registration/RoomChargeModal'
import CatalogPickerModal from '../../components/registration/CatalogPickerModal'
import IPBillingLabTab from '../../components/billing/IPBillingLabTab'
import IPServices from '../../components/billing/IPServices'
import IPProcedures from '../../components/billing/IPProcedures'

const CHARGE_ROWS = [
  { key: 'admission_charge', label: 'Admission Charges' },
  { key: 'room_charge', label: 'Room Charges', picker: 'room' },
  { key: 'service_charge', label: 'Services', picker: 'service' },
  { key: 'procedure_charge', label: 'Procedures / Surgeries', picker: 'procedure' },
  { key: 'lab_charge', label: 'Lab', picker: 'lab' },
  { key: 'doctor_visit_charge', label: 'Doctor Visit' },
  { key: 'radiology_charge', label: 'Radiology' },
  { key: 'ot_charge', label: 'OT Charges' },
  { key: 'medicine_charge', label: 'Medicines' },
  { key: 'nursing_charge', label: 'Nursing Services' },
  { key: 'food_charge', label: 'Food' },
  { key: 'misc_charge', label: 'Miscellaneous' },
]

const initCharges = Object.fromEntries(CHARGE_ROWS.map((c) => [c.key, 0]))

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

const admissionDateOf = (a) => {
  const raw = a.admission_date || a.admitted_at || a.admission_datetime || a.created_at
  if (!raw) return null
  const s = String(raw)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : fmt(d)
}

export default function IPBilling() {
  const [admissions, setAdmissions] = useState([])
  const [admissionId, setAdmissionId] = useState('')
  const [charges, setCharges] = useState(initCharges)
  const [discount, setDiscount] = useState(0)
  const [advanceAdjusted, setAdvanceAdjusted] = useState(0)
  const [paid, setPaid] = useState(0)
  const [bills, setBills] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [activePicker, setActivePicker] = useState(null)
  const [roomSelection, setRoomSelection] = useState(null)
  const [pickedItems, setPickedItems] = useState({ lab_charge: [], procedure_charge: [], service_charge: [] })
  
  const [labRefreshKey, setLabRefreshKey] = useState(0)

  const [activeTab, setActiveTab] = useState('bills')

  const [activeFilter, setActiveFilter] = useState('')
  const [customFrom, setCustomFrom] = useState(fmt(new Date()))
  const [customTo, setCustomTo] = useState(fmt(new Date()))
  const [showModal, setShowModal] = useState(false)

  const loadBills = () => {
    api.get('/ip-billing').then((r) => setBills(r.data))
      .catch((err) => console.error('Failed to load IP bills:', err))
  }

  useEffect(() => {
    api.get('/ip-registrations', { params: { status: 'Admitted' } })
      .then((r) => setAdmissions(r.data))
      .catch((err) => console.error('Failed to load admitted patients:', err))
    loadBills()
  }, [])

  const gross = useMemo(() => {
    return Object.values(charges).reduce((sum, value) => sum + Number(value || 0), 0)
  }, [charges])

  const discountedTotal = Math.max(0, gross - Number(discount || 0))
  const grandTotal = +discountedTotal.toFixed(2)
  const due = +Math.max(0, grandTotal - Number(advanceAdjusted || 0) - Number(paid || 0)).toFixed(2)

  const range = getRange(activeFilter, customFrom, customTo)
  const modalAdmissions = useMemo(() => {
    if (!range) return []
    return admissions.filter((a) => {
      const d = admissionDateOf(a)
      if (!d) return true
      return d >= range.from && d <= range.to
    })
  }, [admissions, range?.from, range?.to])

  const hasAdmissionDates = admissions.some((a) => admissionDateOf(a))
  const rangeLabel = range ? (range.from === range.to ? range.from : `${range.from} → ${range.to}`) : ''
  const selectedAdmission = admissions.find((a) => String(a.id) === String(admissionId)) || null

  const pickFilter = (key) => {
    setActiveFilter(key)
    setShowModal(true)
  }

  const selectAdmission = (a) => {
    setAdmissionId(String(a.id))
    setError('')
    setShowModal(false)
  }

  const applyRoomCharge = (result) => {
    setCharges((current) => ({
      ...current,
      room_charge: result.room_charge,
      doctor_visit_charge: result.doctor_visit_charge,
      nursing_charge: result.nursing_charge,
      misc_charge: Number(current.misc_charge || 0) + result.assistant_doctor_charge,
    }))
    setRoomSelection({ roomType: result.roomType, days: result.days })
    setActivePicker(null)
  }

  const applyCatalogSelection = (chargeKey) => async (selectedList, total) => {
    if (!admissionId) {
      setError('Please select an admitted patient first.')
      setActivePicker(null)
      return
    }

    const items = selectedList.map(item => ({
      item_name: item.investigation_name || item.service_name || item.procedure_name || item.name,
      quantity: item.quantity || 1,
      rate: item.rate || 0,
      amount: item.amount || (item.rate * (item.quantity || 1)) || 0,
    }))

    let endpoint = ''
    if (chargeKey === 'lab_charge') endpoint = '/ip-lab'
    else if (chargeKey === 'service_charge') endpoint = '/ip-services'
    else if (chargeKey === 'procedure_charge') endpoint = '/ip-procedures'
    else return

    try {
      await api.post(endpoint, {
        ip_registration_id: admissionId,
        items: items,
        // Provide payment data so the backend doesn't crash
        total_amount: total,
        discount_percent: 0,
        discount_amount: 0,
        paid_amount: 0,
        balance_amount: total,
        discount_comments: 'NA',
        paymode: 'Cash'
      })

      setCharges((current) => ({
        ...current,
        [chargeKey]: Number(current[chargeKey] || 0) + total,
      }))

      setPickedItems((current) => ({
        ...current,
        [chargeKey]: [...current[chargeKey], ...selectedList],
      }))

      setActivePicker(null)
      
      if (chargeKey === 'lab_charge') {
        setLabRefreshKey((k) => k + 1)
      }
      
    } catch (err) {
      console.error(err)
      setError(err.response?.data?.error || 'Failed to save items')
      setActivePicker(null)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!admissionId) {
      return setError('Select an admitted patient first')
    }
    setError('')
    setSaving(true)
    try {
      await api.post('/ip-billing', {
        ip_registration_id: admissionId,
        ...charges,
        discount,
        advance_adjusted: advanceAdjusted,
        paid_amount: paid,
      })
      setAdmissionId('')
      setCharges(initCharges)
      setDiscount(0)
      setAdvanceAdjusted(0)
      setPaid(0)
      setRoomSelection(null)
      setPickedItems({ lab_charge: [], procedure_charge: [], service_charge: [] })
      loadBills()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create bill')
    } finally {
      setSaving(false)
    }
  }

  const chipSummary = (key) => {
    const items = pickedItems[key]
    if (!items?.length) return null
    const names = items.map((i) => i.investigation_name || i.procedure_name || i.service_name || i.name).filter(Boolean).join(', ')
    return (
      <span className="block text-xs text-teal-600 truncate max-w-[220px]" title={names}>
        {names}
      </span>
    )
  }

  return (
    <div>
      <PageHeader title="Inpatient Billing" subtitle="Create and manage IP bills" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form onSubmit={submit} className="xl:col-span-1">
          <Section title="New IP Bill">
            {error && <p className="text-sm text-danger-500 mb-3">{error}</p>}

            <label className="label">Admitted Patients</label>
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

            <label className="label">Admitted Patient</label>
            <select className="input mb-3" value={admissionId} onChange={(e) => setAdmissionId(e.target.value)}>
              <option value="">Select admission</option>
              {admissions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.ip_reg_no} — {a.name} ({a.room_no || '—'}/{a.bed_no || '—'})
                </option>
              ))}
            </select>

            {selectedAdmission && (
              <div className="border border-teal-600/30 bg-teal-50 rounded-sm px-3 py-2 mb-3 text-xs text-ink/70">
                <div className="font-medium text-sm text-ink">{selectedAdmission.name}</div>
                <div>
                  {selectedAdmission.ip_reg_no}
                  {selectedAdmission.patient_uid ? ` · ${selectedAdmission.patient_uid}` : ''}
                  {selectedAdmission.age != null ? ` · ${selectedAdmission.age} yrs` : ''}
                  {selectedAdmission.gender ? ` · ${selectedAdmission.gender}` : ''}
                </div>
                <div>
                  Room {selectedAdmission.room_no || '—'} / Bed {selectedAdmission.bed_no || '—'}
                  {admissionDateOf(selectedAdmission) ? ` · Admitted ${admissionDateOf(selectedAdmission)}` : ''}
                </div>
              </div>
            )}

            {!admissions.length && (
              <p className="text-xs text-amber-600 mb-3">
                No admitted patients found. Admit a patient first via In Patient Registration.
              </p>
            )}

            <div className="space-y-2 my-3 max-h-72 overflow-y-auto pr-1">
              {CHARGE_ROWS.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink/70">
                    {c.label}
                    {c.key === 'room_charge' && roomSelection && (
                      <span className="block text-xs text-teal-600">
                        {roomSelection.roomType} · {roomSelection.days} day(s)
                      </span>
                    )}
                    {c.picker && c.picker !== 'room' && chipSummary(c.key)}
                  </span>

                  {c.picker ? (
                    <input
                      type="number"
                      readOnly
                      onClick={() => setActivePicker(c.picker)}
                      className="input w-28 text-right cursor-pointer bg-teal-50/50"
                      value={charges[c.key]}
                      title={`Click to select ${c.label.toLowerCase()}`}
                    />
                  ) : (
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
                  )}
                </div>
              ))}
            </div>

            <div className="mb-3">
              <label className="label">Discount</label>
              <input type="number" min="0" step="0.01" className="input" value={discount}
                onChange={(e) => setDiscount(e.target.value)} />
            </div>

            <div className="bg-teal-50 rounded-sm p-3 text-sm space-y-1 mb-3">
              <div className="flex justify-between"><span>Gross Total</span><span>₹{gross.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>₹{Number(discount || 0).toFixed(2)}</span></div>
              <div className="flex justify-between font-semibold"><span>Grand Total</span><span>₹{grandTotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Advance Adjusted</span><span>₹{Number(advanceAdjusted || 0).toFixed(2)}</span></div>
              <div className="flex justify-between text-danger-500"><span>Due</span><span>₹{due.toFixed(2)}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Advance Adjusted</label>
                <input type="number" min="0" step="0.01" className="input" value={advanceAdjusted}
                  onChange={(e) => setAdvanceAdjusted(e.target.value)} />
              </div>
              <div>
                <label className="label">Paid Now</label>
                <input type="number" min="0" step="0.01" className="input" value={paid}
                  onChange={(e) => setPaid(e.target.value)} />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
              <Receipt size={15} />
              {saving ? 'Generating…' : 'Generate IP Bill'}
            </button>
          </Section>
        </form>

        <div className="xl:col-span-2">
          <Section title="IP Records">
            <div className="flex border-b border-border mb-4">
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'bills' ? 'text-teal-700 border-b-2 border-teal-700' : 'text-ink/50 hover:text-ink'
                }`}
                onClick={() => setActiveTab('bills')}
              >
                <Receipt size={14} className="inline mr-1" /> IP Bills
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
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Bill No</th><th>Admission</th><th>Patient</th><th>Grand Total</th>
                        <th>Paid</th><th>Due</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bills.map((b) => (
                        <tr key={b.id}>
                          <td>{b.bill_no}</td>
                          <td>{b.admission_no}</td>
                          <td>{b.patient_name}</td>
                          <td>₹{Number(b.grand_total || 0).toFixed(2)}</td>
                          <td>₹{Number(b.paid_amount || 0).toFixed(2)}</td>
                          <td>₹{Number(b.due_amount || 0).toFixed(2)}</td>
                          <td><StatusBadge status={b.status} /></td>
                        </tr>
                      ))}
                      {!bills.length && <tr><td colSpan={7} className="text-center text-ink/40 py-8">No IP bills yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              
              {activeTab === 'lab' && (
                <IPBillingLabTab 
                  patient={selectedAdmission} 
                  admission={selectedAdmission} 
                  refreshKey={labRefreshKey} 
                />
              )}
              
              {activeTab === 'services' && <IPServices />}
              {activeTab === 'procedures' && <IPProcedures />}
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
                  Admitted Patients · {FILTERS.find((f) => f.key === activeFilter)?.label}
                </h3>
                <p className="text-xs text-ink/50">
                  {`${modalAdmissions.length} patient${modalAdmissions.length === 1 ? '' : 's'}${rangeLabel ? ` (${rangeLabel})` : ''}`}
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

            {admissions.length > 0 && !hasAdmissionDates && (
              <p className="text-xs text-amber-600 px-4 pt-3">
                Admission dates are not available on these records, so all admitted patients are shown.
              </p>
            )}

            <div className="p-4 overflow-y-auto">
              {modalAdmissions.length === 0 ? (
                <p className="text-sm text-ink/40 text-center py-8">No admitted patients found for this period</p>
              ) : (
                <div className="border border-border rounded-sm">
                  {modalAdmissions.map((a) => (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => selectAdmission(a)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-teal-50 border-b border-border last:border-0 ${String(admissionId) === String(a.id) ? 'bg-teal-50' : ''}`}
                    >
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-ink/60">
                        {a.ip_reg_no} · Room {a.room_no || '—'} / Bed {a.bed_no || '—'}
                        {admissionDateOf(a) ? ` · Admitted ${admissionDateOf(a)}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activePicker === 'room' && (
        <RoomChargeModal
          initial={roomSelection}
          onApply={applyRoomCharge}
          onClose={() => setActivePicker(null)}
        />
      )}
      {activePicker === 'lab' && (
        <CatalogPickerModal
          title="Lab Investigations"
          endpoint="/catalog/lab"
          groupField="department"
          nameField="investigation_name"
          onApply={applyCatalogSelection('lab_charge')}
          onClose={() => setActivePicker(null)}
        />
      )}
      {activePicker === 'procedure' && (
        <CatalogPickerModal
          title="Procedures"
          endpoint="/catalog/procedures"
          groupField="procedure_type"
          nameField="procedure_name"
          onApply={applyCatalogSelection('procedure_charge')}
          onClose={() => setActivePicker(null)}
        />
      )}
      {activePicker === 'service' && (
        <CatalogPickerModal
          title="Services"
          endpoint="/catalog/services"
          groupField="service_type"
          nameField="service_name"
          onApply={applyCatalogSelection('service_charge')}
          onClose={() => setActivePicker(null)}
        />
      )}
    </div>
  )
}