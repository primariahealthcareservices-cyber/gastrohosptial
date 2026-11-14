import { useEffect, useState } from 'react'
import api from '../../api/axios'

export default function IPBillingLabTab({ patient, admission }) {
  const [labItems, setLabItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // list-all mode filters (used when no admission is selected)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const showAll = !admission

  const load = (overrides = {}) => {
    const s = overrides.search ?? search
    const sd = overrides.startDate ?? startDate
    const ed = overrides.endDate ?? endDate

    setLoading(true)
    setError('')

    const params = admission
      ? { ip_registration_id: admission.id }
      : {
          search: s || undefined,
          start_date: sd || undefined,
          end_date: ed || undefined,
        }

    api.get('/ip-lab', { params })
      .then((res) => {
        setLabItems(Array.isArray(res.data) ? res.data : (res.data?.data || []))
      })
      .catch((err) => {
        console.error('Failed to load IP lab items:', err)
        setError('Failed to load lab tests.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admission?.id])

  const resetFilters = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
    load({ search: '', startDate: '', endDate: '' })
  }

  return (
    <div className="space-y-4">
      {admission ? (
        <div className="bg-teal-50 border border-teal-200 rounded-sm px-3 py-2 text-xs mb-4">
          <div className="font-semibold text-sm text-ink">{patient?.name || admission.name}</div>
          <div className="text-ink/60">
            IP Reg No: {admission.ip_reg_no} · Room: {admission.room_no || '—'} / Bed: {admission.bed_no || '—'}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 items-end mb-2">
          <div className="flex-1 min-w-[220px]">
            <label className="label">Search (Test / Name / Phone / IP Reg No)</label>
            <input
              className="input w-full"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); load() } }}
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
          <button type="button" onClick={() => load()} className="btn-primary">Apply</button>
          <button type="button" onClick={resetFilters} className="btn-secondary">Reset</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4 text-sm text-gray-500">Loading saved lab tests...</div>
      ) : error ? (
        <div className="text-center py-4 text-red-500 text-sm">{error}</div>
      ) : labItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-sm border border-border">
          No lab tests have been saved {showAll ? 'yet' : 'for this admission yet'}.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border bg-white">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-3 py-2 text-left">Date</th>
                {showAll && <th className="px-3 py-2 text-left">IP Reg No</th>}
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
                  {showAll && <td className="px-3 py-2">{item.ip_reg_no || '—'}</td>}
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
        </div>
      )}
    </div>
  )
}