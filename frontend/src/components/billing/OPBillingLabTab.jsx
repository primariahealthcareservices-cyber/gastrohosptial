import { useEffect, useState } from 'react'
import api from '../../api/axios'
import Pagination from '../common/Pagination'

const PER_PAGE = 25

export default function OPBillingLabTab({ patient, registration }) {
  const [labItems, setLabItems] = useState([])
  const [loading, setLoading] = useState(false)

  // list-all mode (no patient selected)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const loadAll = (p = 1, overrides = {}) => {
    const s = overrides.search ?? search
    const sd = overrides.startDate ?? startDate
    const ed = overrides.endDate ?? endDate
    setLoading(true)
    api.get('/op-lab', {
      params: {
        search: s || undefined,
        start_date: sd || undefined,
        end_date: ed || undefined,
        page: p,
        per_page: PER_PAGE,
      },
    })
      .then((res) => {
        setLabItems(res.data.data || [])
        setTotal(res.data.total || 0)
        setTotalPages(res.data.total_pages || 1)
        setPage(res.data.page || p)
      })
      .catch((err) => console.error('Failed to load lab records:', err))
      .finally(() => setLoading(false))
  }

  // Patient selected -> items for that registration
  // No patient -> all lab records
  useEffect(() => {
    if (patient) {
      if (!registration?.id) {
        setLabItems([])
        return
      }
      setLoading(true)
      api.get('/op-lab', { params: { op_registration_id: registration.id, per_page: 100 } })
        .then((res) => setLabItems(res.data.data || []))
        .catch((err) => console.error('Failed to load lab items for billing:', err))
        .finally(() => setLoading(false))
    } else {
      loadAll(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id, registration?.id])

  const resetFilters = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
    loadAll(1, { search: '', startDate: '', endDate: '' })
  }

  // ---- Patient selected but no registration ----
  if (patient && !registration) {
    return (
      <div className="text-center py-10 text-orange-500 text-sm">
        This patient does not have an active OP Registration.
      </div>
    )
  }

  const showAll = !patient

  return (
    <div className="space-y-4">
      {patient ? (
        <div className="bg-teal-50 border border-teal-200 rounded-sm px-3 py-2 text-xs mb-4">
          <div className="font-semibold text-sm text-ink">{patient.name}</div>
          <div className="text-ink/60">
            Reg No: {registration.opd_reg_no} {patient.phone ? ` · ${patient.phone}` : ''}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 items-end mb-2">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Search (Test / Name / Phone / Reg No)</label>
            <input
              className="input w-full"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadAll(1) } }}
            />
          </div>
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button type="button" onClick={() => loadAll(1)} className="btn-primary">Apply</button>
          <button type="button" onClick={resetFilters} className="btn-secondary">Reset</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4 text-sm text-gray-500">Loading saved lab tests...</div>
      ) : labItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-sm border border-border">
          No lab tests have been saved {showAll ? 'yet' : 'for this registration yet'}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border bg-white">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                {showAll && <th className="px-3 py-2 text-left">Reg No</th>}
                {showAll && <th className="px-3 py-2 text-left">Patient</th>}
                {showAll && <th className="px-3 py-2 text-left">Phone</th>}
                <th className="px-3 py-2 text-left">Lab Test</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Rate (₹)</th>
                <th className="px-3 py-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {labItems.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2">{new Date(item.created_at).toLocaleDateString()}</td>
                  {showAll && <td className="px-3 py-2">{item.opd_reg_no || '—'}</td>}
                  {showAll && <td className="px-3 py-2">{item.patient_name}</td>}
                  {showAll && <td className="px-3 py-2">{item.patient_phone}</td>}
                  <td className="px-3 py-2 font-medium">{item.item_name}</td>
                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">{Number(item.rate || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-600">{Number(item.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {showAll && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              perPage={PER_PAGE}
              onPageChange={(p) => loadAll(p)}
            />
          )}
        </div>
      )}
    </div>
  )
}