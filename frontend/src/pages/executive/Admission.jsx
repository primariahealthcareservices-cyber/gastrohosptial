import { useEffect, useState } from 'react'
import { BedDouble, ArrowRightLeft, LogOut, XCircle } from 'lucide-react'
import api from '../../api/axios'
import { PageHeader, Section, StatusBadge } from '../../components/PageHeader'

export default function Admission() {
  const [patientSearch, setPatientSearch] = useState('')
  const [patients, setPatients] = useState([])
  const [patientId, setPatientId] = useState('')
  const [wards, setWards] = useState([])
  const [rooms, setRooms] = useState([])
  const [beds, setBeds] = useState([])
  
  // --- NEW STATE FOR INVOICES ---
  const [ipDetails, setIpDetails] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  // ------------------------------

  const [form, setForm] = useState({
    ward_id: '', room_id: '', bed_id: '', admission_date: new Date().toISOString().slice(0, 10),
    admission_time: '10:00', reason: '', diagnosis: '', advance_amount: 0,
  })
  const [list, setList] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const loadAdmissions = () => api.get('/admissions').then((r) => setList(r.data))

  useEffect(() => {
    api.get('/admissions/wards').then((r) => setWards(r.data))
    loadAdmissions()
  }, [])

  useEffect(() => {
    if (patientSearch.length > 1) {
      api.get('/patients', { params: { search: patientSearch } }).then((r) => setPatients(r.data))
    } else {
      setPatients([])
    }
  }, [patientSearch])

  useEffect(() => {
    if (form.ward_id) api.get('/admissions/rooms', { params: { ward_id: form.ward_id } }).then((r) => setRooms(r.data))
    else setRooms([])
    setForm((f) => ({ ...f, room_id: '', bed_id: '' }))
  }, [form.ward_id])

  useEffect(() => {
    if (form.room_id) api.get('/admissions/beds', { params: { room_id: form.room_id, status: 'Available' } }).then((r) => setBeds(r.data))
    else setBeds([])
    setForm((f) => ({ ...f, bed_id: '' }))
  }, [form.room_id])

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  // --- NEW FUNCTION TO FETCH IP DETAILS & INVOICES ---
  const fetchPatientInvoices = async (patientUid) => {
    setLoadingInvoices(true)
    setInvoices([])
    setIpDetails(null)
    
    try {
      // 1. Find the IP Registration record for this patient
      const ipRes = await api.get('/ip-registrations', { params: { search: patientUid } })
      
      // Check if they have an active IP registration
      const activeIp = ipRes.data.find(ip => ip.status === 'Admitted')
      
      if (activeIp) {
        setIpDetails(activeIp)
        
        // 2. Fetch Pharmacy Sales for this IP Registration
        const invoiceRes = await api.get('/pharmacy-sales', {
          params: { search: activeIp.ip_reg_no, sale_type: 'IP' }
        })
        setInvoices(invoiceRes.data)
      } else {
        setError("No active IP Admission found for this patient. Please register them as IP first.")
      }
    } catch (err) {
      console.error("Error fetching invoices:", err)
      setError("Could not fetch invoice details.")
    } finally {
      setLoadingInvoices(false)
    }
  }

  // --- UPDATE PATIENT SELECTION ---
  const handleSelectPatient = (p) => {
    setPatientId(p.id)
    setPatientSearch(`${p.name} (${p.patient_uid})`)
    setPatients([])
    setError('')
    
    // Trigger the fetch for invoices
    fetchPatientInvoices(p.patient_uid) 
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!patientId) return setError('Select a patient first')
    setError('')
    setSaving(true)
    try {
      await api.post('/admissions', { patient_id: patientId, ...form })
      setPatientId(''); setPatientSearch('')
      setForm((f) => ({ ...f, ward_id: '', room_id: '', bed_id: '', reason: '', diagnosis: '', advance_amount: 0 }))
      setIpDetails(null)
      setInvoices([])
      loadAdmissions()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not admit patient')
    } finally {
      setSaving(false)
    }
  }

  const discharge = async (id) => { await api.post(`/admissions/${id}/discharge`); loadAdmissions() }
  const cancel = async (id) => {
    const reason = prompt('Reason for cancelling admission?')
    if (reason === null) return
    await api.post(`/admissions/${id}/cancel`, { reason })
    loadAdmissions()
  }

  return (
    <div>
      <PageHeader title="Admission" subtitle="Admit patients, manage rooms, beds and discharge" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <form onSubmit={submit} className="xl:col-span-1">
          <Section title="Admit Patient">
            {error && <p className="text-sm text-danger-500 mb-3">{error}</p>}

            <label className="label">Patient</label>
            <input className="input mb-1" placeholder="Search name or phone…" value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)} />
            {patients.length > 0 && (
              <div className="border border-border rounded-sm mb-3 max-h-40 overflow-y-auto">
                {patients.map((p) => (
                  <button type="button" key={p.id}
                    onClick={() => handleSelectPatient(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 border-b border-border last:border-0">
                    {p.name} · {p.phone}
                  </button>
                ))}
              </div>
            )}

            <label className="label">Ward</label>
            <select className="input mb-3" required value={form.ward_id} onChange={(e) => set('ward_id', e.target.value)}>
              <option value="">Select ward</option>
              {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Room</label>
                <select className="input" required value={form.room_id} onChange={(e) => set('room_id', e.target.value)}>
                  <option value="">Select room</option>
                  {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_no} (₹{r.rate_per_day}/day)</option>)}
                </select>
              </div>
              <div>
                <label className="label">Bed</label>
                <select className="input" required value={form.bed_id} onChange={(e) => set('bed_id', e.target.value)}>
                  <option value="">Select bed</option>
                  {beds.map((b) => <option key={b.id} value={b.id}>Bed {b.bed_no}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">Admission Date</label>
                <input type="date" className="input" required value={form.admission_date} onChange={(e) => set('admission_date', e.target.value)} />
              </div>
              <div>
                <label className="label">Time</label>
                <input type="time" className="input" value={form.admission_time} onChange={(e) => set('admission_time', e.target.value)} />
              </div>
            </div>

            <textarea className="input mb-3" rows={2} placeholder="Reason for admission"
              value={form.reason} onChange={(e) => set('reason', e.target.value)} />
            <textarea className="input mb-3" rows={2} placeholder="Diagnosis"
              value={form.diagnosis} onChange={(e) => set('diagnosis', e.target.value)} />

            <label className="label">Advance Amount</label>
            <input type="number" min="0" className="input mb-4" value={form.advance_amount}
              onChange={(e) => set('advance_amount', e.target.value)} />

            <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={saving}>
              <BedDouble size={15} /> {saving ? 'Admitting…' : 'Admit Patient'}
            </button>
          </Section>
        </form>

        <div className="xl:col-span-2 space-y-5">
          
          {/* --- NEW SECTION: PATIENT DETAILS & INVOICES --- */}
          {ipDetails && (
            <Section title="Patient Details & Pharmacy Invoices">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="label text-xs text-gray-500">Registration#</label>
                  <div className="font-semibold">{ipDetails.ip_reg_no}</div>
                </div>
                <div>
                  <label className="label text-xs text-gray-500">Name</label>
                  <div className="font-semibold">{ipDetails.first_name} {ipDetails.last_name}</div>
                </div>
                <div>
                  <label className="label text-xs text-gray-500">Mobile#</label>
                  <div className="font-semibold">{ipDetails.mobile}</div>
                </div>
                <div>
                  <label className="label text-xs text-gray-500">Gender/Age</label>
                  <div className="font-semibold">{ipDetails.gender} / {ipDetails.age}Y</div>
                </div>
                <div className="md:col-span-2">
                  <label className="label text-xs text-gray-500">Doctor</label>
                  <div className="font-semibold">{ipDetails.doctor_name || 'N/A'}</div>
                </div>
                <div className="md:col-span-2">
                  <label className="label text-xs text-gray-500">Room / Bed</label>
                  <div className="font-semibold">{ipDetails.room_type} / {ipDetails.room_no} / {ipDetails.bed_no}</div>
                </div>
              </div>

              <div className="overflow-x-auto mt-4 border-t pt-4">
                <h4 className="text-sm font-semibold mb-2 text-gray-700">Pharmacy Invoices</h4>
                <table className="w-full text-left text-sm border">
                  <thead className="bg-[#2c8bbb] text-white">
                    <tr>
                      <th className="px-4 py-2 font-medium">Invoice No</th>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Amount</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingInvoices ? (
                      <tr><td colSpan="4" className="text-center py-4">Loading invoices...</td></tr>
                    ) : invoices.length > 0 ? (
                      invoices.map((inv) => (
                        <tr key={inv.id} className="border-b">
                          <td className="px-4 py-2">{inv.sale_no}</td>
                          <td className="px-4 py-2">{new Date(inv.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-2">₹{inv.net_amount}</td>
                          <td className="px-4 py-2">{inv.status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="4" className="text-center py-4 text-gray-500">No pharmacy invoices found for this patient.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
          {/* ------------------------------------------------ */}

          <Section title="Admissions">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr><th>Admission No</th><th>Patient</th><th>Ward / Room / Bed</th><th>Date</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td>{a.admission_no}</td>
                      <td>{a.patient_name}</td>
                      <td>{a.ward_name} / {a.room_no} / {a.bed_no}</td>
                      <td>{a.admission_date}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        {a.status === 'Admitted' && (
                          <div className="flex gap-2">
                            <button title="Discharge" onClick={() => discharge(a.id)} className="text-teal-600 hover:text-teal-700">
                              <LogOut size={15} />
                            </button>
                            <button title="Cancel" onClick={() => cancel(a.id)} className="text-danger-500 hover:text-danger-400">
                              <XCircle size={15} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!list.length && <tr><td colSpan={6} className="text-center text-ink/40 py-8">No admissions yet</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}