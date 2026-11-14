import { useEffect, useState } from 'react'
import { CalendarPlus, Printer, X, RotateCcw } from 'lucide-react'
import api from '../../api/axios'
import { PageHeader, Section, StatusBadge } from '../../components/PageHeader'

const SLOTS = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '14:00-15:00', '15:00-16:00', '16:00-17:00']

const FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
]

// Local-date formatter (avoids the UTC shift that toISOString causes)
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
      // week starts on Monday
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

export default function Appointments() {
  const [departments, setDepartments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [list, setList] = useState([])
  const [form, setForm] = useState({
    patient_id: '', department_id: '', doctor_id: '', appointment_date: fmt(new Date()),
    time_slot: SLOTS[0], visit_type: 'New',
  })
  const [patientSearch, setPatientSearch] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Patient date filter
  const [activeFilter, setActiveFilter] = useState('')
  const [customFrom, setCustomFrom] = useState(fmt(new Date()))
  const [customTo, setCustomTo] = useState(fmt(new Date()))
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [modalPatients, setModalPatients] = useState([])

  const loadAppointments = () => api.get('/appointments').then((r) => setList(r.data))

  useEffect(() => {
    api.get('/appointments/departments').then((r) => setDepartments(r.data))
    api.get('/appointments/doctors').then((r) => setDoctors(r.data))
    loadAppointments()
  }, [])

  // Inline typed search (name / phone / MR number)
  useEffect(() => {
    if (form.patient_id) return // a patient is selected; the box shows their label
    if (patientSearch.length > 1) {
      api.get('/patients', { params: { search: patientSearch } }).then((r) => setPatients(r.data))
    } else {
      setPatients([])
    }
  }, [patientSearch, form.patient_id])

  // Pop-up list: patients registered in the selected date range
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

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const filteredDoctors = form.department_id
    ? doctors.filter((d) => String(d.department_id) === String(form.department_id))
    : doctors

  const pickFilter = (key) => {
    setActiveFilter(key)
    setShowModal(true)
  }

  const selectPatient = (p) => {
    setSelectedPatient(p)
    setForm((f) => ({ ...f, patient_id: p.id }))
    setPatientSearch(`${p.name} (${p.patient_uid})`)
    setPatients([])
    setShowModal(false)
  }

  const handleSearchChange = (e) => {
    setPatientSearch(e.target.value)
    if (form.patient_id) {
      set('patient_id', '') // typing again clears the selected patient
      setSelectedPatient(null)
    }
  }

  const handleBook = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.patient_id) return setError('Select a patient first')
    setSaving(true)
    try {
      await api.post('/appointments', form)
      loadAppointments()
      setForm((f) => ({ ...f, patient_id: '' }))
      setSelectedPatient(null)
      setPatientSearch('')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not book appointment')
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (id, status) => {
    await api.patch(`/appointments/${id}/status`, { status })
    loadAppointments()
  }

  const rangeLabel = (() => {
    const r = getRange(activeFilter, customFrom, customTo)
    if (!r) return ''
    return r.from === r.to ? r.from : `${r.from} → ${r.to}`
  })()

  return (
    <div>
      <PageHeader title="Appointment" subtitle="Book, reschedule, and manage patient appointments" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form onSubmit={handleBook} className="xl:col-span-1">
          <Section title="Book Appointment">
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
              placeholder="Search by name or phone…"
              value={patientSearch}
              onChange={handleSearchChange}
            />

            {/* Inline results for typed search */}
            {patients.length > 0 && (
              <div className="border border-border rounded-sm mb-3 max-h-48 overflow-y-auto">
                {patients.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => selectPatient(p)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-teal-50 border-b border-border last:border-0 ${String(form.patient_id) === String(p.id) ? 'bg-teal-50 font-medium' : ''}`}
                  >
                    {p.name} · {p.phone} · {p.patient_uid}
                  </button>
                ))}
              </div>
            )}

            {selectedPatient && (
              <div className="border border-teal-600/30 bg-teal-50 rounded-sm px-3 py-2 mb-3 text-xs text-ink/70">
                <div className="font-medium text-sm text-ink">{selectedPatient.name}</div>
                <div>
                  {selectedPatient.patient_uid}
                  {selectedPatient.reg_no ? ` · ${selectedPatient.reg_no}` : ''}
                  {selectedPatient.age != null ? ` · ${selectedPatient.age} yrs` : ''}
                  {selectedPatient.gender ? ` · ${selectedPatient.gender}` : ''}
                </div>
                <div>{selectedPatient.phone}</div>
              </div>
            )}

            {!patients.length && !selectedPatient && <div className="mb-3" />}

            <label className="label">Department</label>
            <select className="input mb-3" value={form.department_id} onChange={(e) => set('department_id', e.target.value)}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>

            <label className="label">Doctor</label>
            <select className="input mb-3" required value={form.doctor_id} onChange={(e) => set('doctor_id', e.target.value)}>
              <option value="">Select doctor</option>
              {filteredDoctors.map((d) => <option key={d.id} value={d.id}>{d.name} (₹{d.consultation_fee})</option>)}
            </select>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" required value={form.appointment_date} onChange={(e) => set('appointment_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Time Slot</label>
                <select className="input" value={form.time_slot} onChange={(e) => set('time_slot', e.target.value)}>
                  {SLOTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <label className="label">Visit Type</label>
            <div className="flex gap-2 mb-4">
              {['New', 'Follow-up', 'Emergency'].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => set('visit_type', v)}
                  className={`flex-1 text-xs py-2 rounded-sm border ${form.visit_type === v ? 'bg-teal-600 text-white border-teal-600' : 'border-border text-ink/60'}`}
                >
                  {v}
                </button>
              ))}
            </div>

            <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
              <CalendarPlus size={15} /> {saving ? 'Booking…' : 'Book Appointment'}
            </button>
          </Section>
        </form>

        <div className="xl:col-span-2">
          <Section title="Appointments">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Token</th><th>Patient</th><th>Doctor</th><th>Date</th><th>Slot</th>
                    <th>Type</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td>#{a.token_no}</td>
                      <td>{a.patient_name}</td>
                      <td>{a.doctor_name}</td>
                      <td>{a.appointment_date}</td>
                      <td>{a.time_slot}</td>
                      <td>{a.visit_type}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {a.status === 'Booked' && (
                          <div className="flex gap-1.5">
                            <button type="button" title="Complete" onClick={() => changeStatus(a.id, 'Completed')} className="text-teal-600 hover:text-teal-700">
                              <Printer size={15} />
                            </button>
                            <button type="button" title="Reschedule" onClick={() => changeStatus(a.id, 'Rescheduled')} className="text-amber-500 hover:text-amber-600">
                              <RotateCcw size={15} />
                            </button>
                            <button type="button" title="Cancel" onClick={() => changeStatus(a.id, 'Cancelled')} className="text-danger-500 hover:text-danger-400">
                              <X size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!list.length && (
                    <tr><td colSpan={8} className="text-center text-ink/40 py-8">No appointments yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>

      {/* Pop-up: registered patients for the chosen period */}
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