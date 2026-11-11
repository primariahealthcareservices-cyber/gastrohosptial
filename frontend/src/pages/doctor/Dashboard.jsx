import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { CalendarClock, CheckCircle, Clock, BedDouble } from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { PageHeader, Section, StatusBadge } from '../../components/PageHeader'

function Stat({ label, value, icon: Icon, bg, color }) {
  return (
    <div className="bg-white border border-border rounded-sm p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${bg}`}>
          <Icon size={20} className={color} />
        </div>
        <div>
          <p className="text-sm text-ink/50">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  )
}

export default function DoctorDashboard() {
  const { user } = useAuth()
  const isAdminView = ['admin', 'super_admin'].includes(user?.role)

  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isAdminView) return
    api.get('/doctors').then((r) => setDoctors(r.data)).catch(console.error)
  }, [isAdminView])

  useEffect(() => {
    setLoading(true); setError('')
    const params = isAdminView && doctorId ? { doctor_id: doctorId } : {}
    api.get('/doctor-dashboard/overview', { params })
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [doctorId, isAdminView])

  const picker = isAdminView && (
    <select className="input max-w-xs" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
      <option value="">Select a doctor…</option>
      {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  )

  const subtitle = data?.linked
    ? [data.doctor.name, data.doctor.department || data.doctor.specialization].filter(Boolean).join(' · ')
    : "Today's appointments and admitted patients"

  return (
    <div>
      <PageHeader title="Doctor Dashboard" subtitle={subtitle} action={picker || undefined} />

      {error && (
        <div className="text-sm text-danger-500 bg-danger-50 border border-danger-200 rounded-sm px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {loading && <div className="text-center py-4">Loading...</div>}

      {!loading && data && !data.linked && (
        <div className="text-sm bg-yellow-50 border border-yellow-200 rounded-sm p-4">
          {isAdminView
            ? 'Select a doctor above to view their dashboard.'
            : 'Your login is not linked to a doctor profile yet. Ask the administrator to link it.'}
        </div>
      )}

      {!loading && data?.linked && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat label="Appointments Today" value={data.summary.appointments_today} icon={CalendarClock} bg="bg-teal-50" color="text-teal-600" />
            <Stat label="Waiting" value={data.summary.waiting} icon={Clock} bg="bg-amber-50" color="text-amber-500" />
            <Stat label="Completed" value={data.summary.completed} icon={CheckCircle} bg="bg-green-50" color="text-green-500" />
            <Stat label="Admitted IP Patients" value={data.summary.admitted_ip} icon={BedDouble} bg="bg-indigo-50" color="text-indigo-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Section title="Today's Appointments" className="lg:col-span-2">
              {data.appointments.length === 0 ? (
                <p className="text-sm text-ink/50">No appointments today.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr><th>Token</th><th>Time</th><th>Patient</th><th>MR No</th><th>Type</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {data.appointments.map((a) => (
                        <tr key={a.id}>
                          <td>{a.token_no ?? '-'}</td>
                          <td>{a.time_slot || '-'}</td>
                          <td>{a.patient_name}{a.age ? `, ${a.age}` : ''}{a.gender ? ` / ${a.gender[0]}` : ''}</td>
                          <td>{a.mr_number}</td>
                          <td>{a.visit_type}</td>
                          <td><StatusBadge status={a.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            <Section title="Appointments (Last 7 Days)">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.appointments_per_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8E7" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0E7C7B" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          <Section title={`Admitted Patients (${data.admitted.length})`}>
            {data.admitted.length === 0 ? (
              <p className="text-sm text-ink/50">No admitted patients.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>IP No</th><th>Patient</th><th>Room / Bed</th><th>Type</th><th>Admitted</th><th>Symptoms</th></tr>
                  </thead>
                  <tbody>
                    {data.admitted.map((r) => (
                      <tr key={r.id}>
                        <td>{r.ip_reg_no}</td>
                        <td>{r.name}{r.age ? `, ${r.age}` : ''}</td>
                        <td>{[r.room_no, r.bed_no].filter(Boolean).join(' / ') || '-'}</td>
                        <td>{r.room_type}</td>
                        <td>{r.admitted_on}</td>
                        <td className="max-w-xs truncate">{r.symptoms || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}