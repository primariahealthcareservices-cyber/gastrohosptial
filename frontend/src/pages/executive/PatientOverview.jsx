import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, FileText, Pencil } from 'lucide-react'
import api from '../../api/axios'
import { PageHeader, Section } from '../../components/PageHeader'

function fmt(n) {
  return `₹${Number(n || 0).toFixed(2)}`
}
function fmtDate(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function PatientOverview() {
  const { id } = useParams()           // ip_registration_id
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      setLoading(true); setError('')
      try {
        const res = await api.get(`/patient-overview/${id}`)
        setData(res.data)
      } catch (err) {
        console.error(err)
        setError(err.response?.data?.error || 'Failed to load patient overview')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  if (loading) return <div className="p-8 text-center">Loading…</div>
  if (error)   return <div className="p-8 text-center text-danger-500">{error}</div>
  if (!data)   return <div className="p-8 text-center">Not found</div>

  const { admission, bill, pharmacy, lab, discharge } = data
  const billCategories = bill ? [
    ['Admission', bill.admission_charge],
    ['Room', bill.room_charge],
    ['Doctor Visit', bill.doctor_visit_charge],
    ['Lab', bill.lab_charge],
    ['Radiology', bill.radiology_charge],
    ['OT', bill.ot_charge],
    ['Procedure', bill.procedure_charge],
    ['Medicine', bill.medicine_charge],
    ['Nursing', bill.nursing_charge],
    ['Service', bill.service_charge],
    ['Food', bill.food_charge],
    ['Misc', bill.misc_charge],
  ] : []

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title={`Patient Overview — ${admission.name || 'Unknown'}`}
        subtitle={`IP Reg No: ${admission.ip_reg_no || '—'}`}
      />

      <div className="flex gap-2 mb-6">
        <button className="btn-secondary flex items-center gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <button className="btn-secondary flex items-center gap-2" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </button>
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => navigate(`/executive/discharge-summary/${id}`)}
        >
          <Pencil size={16} /> Edit Discharge Summary
        </button>
      </div>

      {/* 1. Patient & Admission */}
      <Section title="Patient & Admission">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-ink/50">Name</div><div className="font-medium">{admission.name}</div></div>
          <div><div className="text-ink/50">Gender / Age</div><div className="font-medium">{admission.gender} / {admission.age}Y</div></div>
          <div><div className="text-ink/50">Mobile</div><div className="font-medium">{admission.mobile || '—'}</div></div>
          <div><div className="text-ink/50">Blood Group</div><div className="font-medium">{admission.blood_group || '—'}</div></div>
          <div><div className="text-ink/50">Admitted</div><div className="font-medium">{fmtDate(admission.admitted_date)}</div></div>
          <div><div className="text-ink/50">Discharged</div><div className="font-medium">{fmtDate(admission.discharge_date)}</div></div>
          <div><div className="text-ink/50">Doctor</div><div className="font-medium">{admission.doctor_name || '—'}</div></div>
          <div><div className="text-ink/50">Room / Bed</div><div className="font-medium">{admission.room_type || ''} {admission.room_no || ''} / {admission.bed_no || '—'}</div></div>
        </div>
      </Section>

      {/* 2. Billing */}
      <Section title="IP Bill">
        {!bill ? (
          <div className="text-sm text-ink/50">No IP bill yet.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm mb-4">
              {billCategories.map(([label, val]) => (
                <div key={label} className="flex justify-between border-b py-1">
                  <span className="text-ink/60">{label}</span>
                  <span className="font-medium">{fmt(val)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-t pt-4">
              <div><div className="text-ink/50">Bill No</div><div className="font-medium">{bill.bill_no}</div></div>
              <div><div className="text-ink/50">Status</div><div className="font-medium">{bill.status}</div></div>
              <div><div className="text-ink/50">Payment Mode</div><div className="font-medium">{bill.payment_mode}</div></div>
              <div><div className="text-ink/50">Created</div><div className="font-medium">{fmtDate(bill.created_at)}</div></div>
              <div><div className="text-ink/50">Gross Total</div><div className="font-medium">{fmt(bill.gross_total)}</div></div>
              <div><div className="text-ink/50">Discount</div><div className="font-medium">{fmt(bill.discount)}</div></div>
              <div><div className="text-ink/50">Grand Total</div><div className="font-bold">{fmt(bill.grand_total)}</div></div>
              <div><div className="text-ink/50">Advance Adjusted</div><div className="font-medium">{fmt(bill.advance_adjusted)}</div></div>
              <div><div className="text-ink/50">Paid</div><div className="font-medium">{fmt(bill.paid_amount)}</div></div>
              <div><div className="text-ink/50">Due</div><div className="font-bold text-danger-500">{fmt(bill.due_amount)}</div></div>
            </div>
          </>
        )}
      </Section>

      {/* 3. Pharmacy Sales */}
      <Section title={`Pharmacy Sales (${pharmacy.sales.length} invoice${pharmacy.sales.length === 1 ? '' : 's'})`}>
        {pharmacy.sales.length === 0 ? (
          <div className="text-sm text-ink/50">No pharmacy sales recorded.</div>
        ) : (
          <>
            <div className="overflow-x-auto mb-3">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Item</th>
                    <th>Batch</th>
                    <th>Qty</th>
                    <th>MRP</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pharmacy.sales.flatMap(sale =>
                    sale.items.map((item, idx) => (
                      <tr key={`${sale.id}-${idx}`}>
                        <td>{idx === 0 ? fmtDate(sale.created_at) : ''}</td>
                        <td>{idx === 0 ? sale.sale_no : ''}</td>
                        <td>{item.item_name}</td>
                        <td>{item.batch_no || '—'}</td>
                        <td>{item.qty}</td>
                        <td>{fmt(item.mrp)}</td>
                        <td>{fmt(item.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="text-right font-bold text-sm">
              Total Pharmacy: {fmt(pharmacy.total)}
            </div>
          </>
        )}
      </Section>

      {/* 4. Lab */}
      <Section title="Lab Tests">
        {lab.ip.length === 0 && lab.op.length === 0 ? (
          <div className="text-sm text-ink/50">No lab tests recorded.</div>
        ) : (
          <>
            {lab.ip.length > 0 && (
              <div className="mb-4">
                <div className="font-semibold text-sm mb-2">IP Lab</div>
                <table className="table-base">
                  <thead>
                    <tr><th>Date</th><th>Test</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {lab.ip.map(l => (
                      <tr key={l.id}>
                        <td>{fmtDate(l.created_at)}</td>
                        <td>{l.item_name}</td>
                        <td>{l.quantity}</td>
                        <td>{fmt(l.rate)}</td>
                        <td>{fmt(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-right font-bold text-sm mt-1">IP Lab Total: {fmt(lab.ip_total)}</div>
              </div>
            )}
            {lab.op.length > 0 && (
              <div>
                <div className="font-semibold text-sm mb-2">OP Lab</div>
                <table className="table-base">
                  <thead>
                    <tr><th>Date</th><th>Test</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {lab.op.map(l => (
                      <tr key={l.id}>
                        <td>{fmtDate(l.created_at)}</td>
                        <td>{l.item_name}</td>
                        <td>{l.quantity}</td>
                        <td>{fmt(l.rate)}</td>
                        <td>{fmt(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-right font-bold text-sm mt-1">OP Lab Total: {fmt(lab.op_total)}</div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* 5. Discharge Summary */}
      <Section title="Discharge Summary">
        {!discharge ? (
          <div className="text-sm text-ink/50">
            Not saved yet.{' '}
            <button
              className="text-teal-600 hover:underline"
              onClick={() => navigate(`/executive/discharge-summary/${id}`)}
            >
              Create one
            </button>
          </div>
        ) : (
          <div className="text-sm space-y-2">
            <div><span className="text-ink/50">Diagnosis:</span> {discharge.diagnosis || '—'}</div>
            <div><span className="text-ink/50">Procedure:</span> {discharge.procedure || '—'}</div>
            <div><span className="text-ink/50">Condition at discharge:</span> {discharge.condition_discharge || '—'}</div>
            <button
              className="text-teal-600 hover:underline flex items-center gap-1"
              onClick={() => navigate(`/executive/discharge-summary/${id}`)}
            >
              <FileText size={14} /> View / Edit full summary
            </button>
          </div>
        )}
      </Section>
    </div>
  )
}