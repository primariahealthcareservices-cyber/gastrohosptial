import { useState, Fragment } from 'react'
import {
  Printer, Download, Search as SearchIcon, Users, Stethoscope,
  MessageSquare, Footprints, Microscope, Radio, UserPlus,
  BedDouble, IndianRupee, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import api from '../../api/axios'
import { Section } from '../PageHeader'

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY_BUCKET = { cash: 0, card: 0, upi: 0, bank: 0, total: 0, count: 0 }
const EMPTY_REFUND = { cash: 0, card: 0, upi: 0, bank: 0, total: 0, count: 0 }

const fmt = (n) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const THEME = {
  red:    { bg: 'bg-red-50',     border: 'border-red-100',     chip: 'bg-red-400' },
  green:  { bg: 'bg-emerald-50', border: 'border-emerald-100', chip: 'bg-emerald-500' },
  orange: { bg: 'bg-amber-50',   border: 'border-amber-100',   chip: 'bg-amber-400' },
  blue:   { bg: 'bg-sky-50',     border: 'border-sky-100',     chip: 'bg-sky-400' },
  navy:   { bg: 'bg-blue-50',    border: 'border-blue-100',    chip: 'bg-blue-600' },
}

const PAGE_SIZE = 30

function StatCard({ icon: Icon, theme = 'blue', title, value, sub }) {
  const t = THEME[theme]
  return (
    <div className={`flex items-stretch rounded-sm border ${t.border} ${t.bg} overflow-hidden`}>
      <div className={`flex items-center justify-center w-14 shrink-0 ${t.chip}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="p-3 flex flex-col justify-center">
        <p className="text-[11px] tracking-wide text-ink/50 uppercase">{title}</p>
        <p className="text-lg font-semibold text-ink leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-ink/40">{sub}</p>}
      </div>
    </div>
  )
}

function CollectionCard({
  icon: Icon, theme = 'blue', title, bucket, refund, category,
  onCellClick, showRefund = false,
}) {
  const t = THEME[theme]
  const b = bucket || EMPTY_BUCKET
  const r = refund || EMPTY_REFUND
  const clickable = 'cursor-pointer hover:underline hover:text-teal-700'

  return (
    <div className={`flex items-stretch rounded-sm border ${t.border} ${t.bg} overflow-hidden`}>
      <div className={`flex items-center justify-center w-14 shrink-0 ${t.chip}`}>
        <Icon size={22} className="text-white" />
      </div>

      <div className="p-3 flex-1 text-xs">
        <p className="uppercase tracking-wide text-ink/50 text-[11px] mb-1">
          {title} — {b.count ?? 0}
        </p>
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <span className={`text-ink/50 ${clickable}`} onClick={() => onCellClick(category, 'cash')}>CASH</span>
          <span className="text-right font-medium">{fmt(b.cash)}</span>

          <span className={`text-ink/50 ${clickable}`} onClick={() => onCellClick(category, 'card')}>CARD</span>
          <span className="text-right font-medium">{fmt(b.card)}</span>

          <span className={`text-ink/50 ${clickable}`} onClick={() => onCellClick(category, 'upi')}>UPI</span>
          <span className="text-right font-medium">{fmt(b.upi)}</span>

          <span className={`text-ink/50 ${clickable}`} onClick={() => onCellClick(category, 'bank')}>BANK</span>
          <span className="text-right font-medium">{fmt(b.bank)}</span>

          <span
            className={`text-ink/60 font-semibold border-t border-ink/10 pt-0.5 mt-0.5 ${clickable}`}
            onClick={() => onCellClick(category, 'total')}
          >TOTAL</span>
          <span className="text-right font-semibold border-t border-ink/10 pt-0.5 mt-0.5">{fmt(b.total)}</span>
        </div>
      </div>

      {showRefund && (
        <div className="w-32 shrink-0 border-l border-amber-200/70 bg-amber-50/70 px-3 py-2 text-xs flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-wide text-amber-800 font-semibold">
            Refunds-{r.count ?? 0}
          </p>
          <div className="mt-1 space-y-0.5 text-[11px] text-amber-900">
            <div className="flex justify-between">
              <span className="text-amber-700/80">Cash</span>
              <span className="font-medium">{fmt(r.cash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-700/80">Card</span>
              <span className="font-medium">{fmt(r.card)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-700/80">UPI</span>
              <span className="font-medium">{fmt(r.upi)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-amber-700/80">Bank</span>
              <span className="font-medium">{fmt(r.bank)}</span>
            </div>
            <div className="flex justify-between border-t border-amber-200 pt-0.5 mt-0.5 font-semibold">
              <span>Total</span>
              <span>{fmt(r.total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MoneyCard({ theme, title, value }) {
  const t = THEME[theme]
  return (
    <div className={`flex items-stretch rounded-sm border ${t.border} ${t.bg} overflow-hidden`}>
      <div className={`flex items-center justify-center w-14 shrink-0 ${t.chip}`}>
        <IndianRupee size={22} className="text-white" />
      </div>
      <div className="p-3 flex flex-col justify-center text-xs">
        <p className="uppercase tracking-wide text-ink/50 text-[11px]">{title}</p>
        <p className="text-lg font-semibold text-ink">{fmt(value)}</p>
      </div>
    </div>
  )
}

function DueCard({ due }) {
  const rows = [
    ['OP & DIRECT BILL DUE', due.op_direct_bill_due],
    ['OP LAB & RADIOLOGY DUE', due.op_lab_radiology_due],
    ['IP BILL DUE', due.ip_bill_due],
    ['IP LAB & RADIOLOGY DUE', due.ip_lab_radiology_due],
  ]
  return (
    <div className="flex items-stretch rounded-sm border border-blue-100 bg-blue-50 overflow-hidden">
      <div className="flex items-center justify-center w-14 shrink-0 bg-blue-600">
        <IndianRupee size={22} className="text-white" />
      </div>
      <div className="p-3 flex-1 text-xs">
        <p className="uppercase tracking-wide text-ink/50 text-[11px] mb-1">Due Total</p>
        <div className="grid grid-cols-[1fr_auto] gap-y-0.5">
          {rows.map(([label, val]) => (
            <Fragment key={label}>
              <span className="text-ink/60">{label}</span>
              <span className="text-right font-medium">{fmt(val)}</span>
            </Fragment>
          ))}
          <span className="text-ink/60 font-semibold border-t border-ink/10 pt-0.5 mt-0.5">TOTAL</span>
          <span className="text-right font-semibold border-t border-ink/10 pt-0.5 mt-0.5">{fmt(due.total_due)}</span>
        </div>
      </div>
    </div>
  )
}

const CATEGORY_LABEL = {
  op_billing:          'OP Billing',
  op_diagnostics:      'OP Diagnostics',
  op_radiology:        'OP Radiology',
  direct_patients:     'Direct Patients',
  direct_diagnostics:  'Direct Diagnostics',
  direct_radiology:    'Direct Radiology',
  ip_income:           'IP Income',
  ip_diagnostics:      'IP Diagnostics',
  ip_radiology:        'IP Radiology',
}

const MODE_LABEL = {
  cash:  'Cash',
  card:  'Card',
  upi:   'UPI',
  bank:  'Bank',
  total: 'Total',
}

function BreakdownModal({ open, onClose, params, startDate, endDate }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loadedKey, setLoadedKey] = useState(null)

  if (!open) return null
  const { category, mode } = params
  const key = `${category}|${mode}|${startDate}|${endDate}`

  if (loadedKey !== key) {
    setLoadedKey(key)
    setRows([])
    setQuery('')
    setPage(1)
    setLoading(true)
    setError(null)
    api.get('/dashboard/collection-breakdown', {
      params: { start_date: startDate, end_date: endDate, category, mode },
    })
      .then((res) => setRows(res.data.rows || []))
      .catch((e) => setError(e?.response?.data?.message || e.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }

  const filtered = rows.filter((r) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      String(r.patient_reg_no || '').toLowerCase().includes(q) ||
      String(r.name || '').toLowerCase().includes(q) ||
      String(r.phone || '').toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIdx = (safePage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE)

  const totalOf = (k) => filtered.reduce((s, r) => s + Number(r[k] || 0), 0)

  const goTo = (p) => setPage(Math.min(Math.max(1, p), totalPages))

  const exportCsv = () => {
    const header = ['Patient Reg No.', 'Name', 'Phone', 'Cash(₹)', 'Card(₹)', 'UPI(₹)', 'Bank(₹)', 'Total(₹)']
    const lines = [header]
    filtered.forEach((r) => {
      lines.push([
        r.patient_reg_no || '',
        (r.name || '').replace(/,/g, ' '),
        r.phone || '',
        r.cash, r.card, r.upi, r.bank, r.total,
      ])
    })
    const csv = lines.map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `breakdown-${category}-${mode}-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const pageButtons = () => {
    const buttons = []
    const window = 5
    let start = Math.max(1, safePage - Math.floor(window / 2))
    let end = Math.min(totalPages, start + window - 1)
    if (end - start + 1 < window) start = Math.max(1, end - window + 1)
    for (let p = start; p <= end; p++) buttons.push(p)
    return buttons
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-6xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-ink">
            {CATEGORY_LABEL[category]} — {MODE_LABEL[mode]} Breakdown
            <span className="text-xs text-ink/50 ml-2">({startDate} to {endDate})</span>
          </h3>
          <div className="flex items-center gap-2">
            <button className="btn-secondary flex items-center gap-1 text-xs" onClick={exportCsv} disabled={!filtered.length}>
              <Download size={13} /> Export
            </button>
            <div className="relative">
              <input
                className="input pl-7 text-xs w-56"
                placeholder="Name/RegNo/Phone"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1) }}
              />
              <SearchIcon size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-ink/40" />
            </div>
            <button onClick={onClose} className="p-1 hover:bg-ink/5 rounded">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {loading && <p className="text-sm text-ink/50 p-6">Loading…</p>}
          {error && <p className="text-sm text-red-600 p-6">{error}</p>}
          {!loading && !error && filtered.length === 0 && (
            <p className="text-sm text-ink/50 p-6">No records found.</p>
          )}

          {!loading && !error && filtered.length > 0 && (
            <table className="w-full text-xs">
              <thead className="bg-sky-500 text-white sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Patient Reg No.</th>
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium">Phone</th>
                  <th className="text-right px-3 py-2 font-medium">Cash(₹)</th>
                  <th className="text-right px-3 py-2 font-medium">Card(₹)</th>
                  <th className="text-right px-3 py-2 font-medium">UPI(₹)</th>
                  <th className="text-right px-3 py-2 font-medium">Bank(₹)</th>
                  <th className="text-right px-3 py-2 font-medium">Total(₹)</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={i} className={i % 2 ? 'bg-sky-50/40' : ''}>
                    <td className="px-3 py-1.5">{r.patient_reg_no}</td>
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5">{r.phone}</td>
                    <td className="px-3 py-1.5 text-right">{Number(r.cash).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-1.5 text-right">{Number(r.card).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-1.5 text-right">{Number(r.upi).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-1.5 text-right">{Number(r.bank).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-1.5 text-right">{Number(r.total).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-ink/5 font-semibold">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-right">Totals (all pages)</td>
                  <td className="px-3 py-2 text-right">{totalOf('cash').toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right">{totalOf('card').toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right">{totalOf('upi').toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right">{totalOf('bank').toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2 text-right">{totalOf('total').toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {!loading && !error && filtered.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t text-xs">
            <span className="text-ink/60">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => goTo(1)} disabled={safePage === 1}
                className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-ink/5">«</button>
              <button onClick={() => goTo(safePage - 1)} disabled={safePage === 1}
                className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-ink/5">
                <ChevronLeft size={12} />
              </button>
              {pageButtons().map((p) => (
                <button key={p} onClick={() => goTo(p)}
                  className={`px-2 py-1 border rounded ${p === safePage ? 'bg-sky-500 text-white border-sky-500' : 'hover:bg-ink/5'}`}>{p}</button>
              ))}
              <button onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages}
                className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-ink/5">
                <ChevronRight size={12} />
              </button>
              <button onClick={() => goTo(totalPages)} disabled={safePage === totalPages}
                className="px-2 py-1 border rounded disabled:opacity-40 hover:bg-ink/5">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CollectionSummary() {
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [clinic, setClinic] = useState('All')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [breakdown, setBreakdown] = useState({ open: false, category: null, mode: null })

  const openBreakdown = (category, mode) => setBreakdown({ open: true, category, mode })
  const closeBreakdown = () => setBreakdown({ open: false, category: null, mode: null })

  const getData = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await api.get('/dashboard/collection-summary', {
        params: { start_date: startDate, end_date: endDate, clinic },
      })
      setData(data)
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // Refund is now an object per category
  const refundOf = (key) => data?.refunds?.[key] || EMPTY_REFUND

  const exportCsv = () => {
    if (!data) return
    const lines = [['Category', 'Count', 'Cash', 'Card', 'UPI', 'Bank', 'Total', 'Refunds']]
    const rows = [
      ['OP Billing', data.op_billing, 'op_billing'],
      ['OP Diagnostics', data.op_diagnostics, 'op_diagnostics'],
      ['OP Radiology', data.op_radiology, 'op_radiology'],
      ['Direct Patients', data.direct_patients, 'direct_patients'],
      ['Direct Diagnostics', data.direct_diagnostics, 'direct_diagnostics'],
      ['Direct Radiology', data.direct_radiology, 'direct_radiology'],
      ['IP Income', data.ip_income, 'ip_income'],
      ['IP Diagnostics', data.ip_diagnostics, 'ip_diagnostics'],
      ['IP Radiology', data.ip_radiology, 'ip_radiology'],
    ]
    rows.forEach(([label, b, key]) => {
      const x = b || EMPTY_BUCKET
      lines.push([label, x.count ?? 0, x.cash, x.card, x.upi, x.bank, x.total, refundOf(key).total])
    })
    lines.push([])
    lines.push(['Total Income', '', '', '', '', '', data.total_income, ''])
    lines.push(['Expenses', '', '', '', '', '', data.expenses, ''])
    lines.push(['Grand Total', '', '', '', '', '', data.grand_total, ''])

    const csv = lines.map((r) => r.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `collection-summary-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Section title="Hospital Collection">
      <div className="flex flex-wrap items-end gap-3 mb-5 print:hidden">
        <div>
          <label className="label">Start Date</label>
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="label">End Date</label>
          <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Clinic</label>
          <select className="input" value={clinic} onChange={(e) => setClinic(e.target.value)}>
            <option>All</option>
            <option>Main Clinic</option>
          </select>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={getData} disabled={loading}>
          <SearchIcon size={15} /> {loading ? 'Loading…' : 'Get Data'}
        </button>
        <button className="btn-secondary flex items-center gap-2" onClick={() => window.print()} disabled={!data}>
          <Printer size={15} /> Print
        </button>
        <button className="btn-secondary flex items-center gap-2" onClick={exportCsv} disabled={!data}>
          <Download size={15} /> Export
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!data && !error && (
        <p className="text-sm text-ink/40">
          Choose a date range and click Get Data to load collection data.
        </p>
      )}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={Users} theme="red" title="Users" value={data.meta.users} />
            <StatCard icon={Stethoscope} theme="green" title="Doctors" value={data.meta.doctors} />
            <StatCard
              icon={MessageSquare} theme="orange" title="Last Updated / SMS"
              value={new Date(data.meta.last_updated).toLocaleString()}
              sub={`SMS Remaining: ${data.meta.sms_remaining ?? '0'}`}
            />
          </div>

          {/* Row 1 — OP Billing (no refund), OP Diagnostics + OP Radiology (refund) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CollectionCard icon={Footprints} theme="blue" title="OP Billing"
              bucket={data.op_billing} category="op_billing"
              refund={refundOf('op_billing')} showRefund={false}
              onCellClick={openBreakdown} />
            <CollectionCard icon={Microscope} theme="blue" title="OP Diagnostics"
              bucket={data.op_diagnostics} category="op_diagnostics"
              refund={refundOf('op_diagnostics')} showRefund={true}
              onCellClick={openBreakdown} />
            <CollectionCard icon={Radio} theme="blue" title="OP Radiology"
              bucket={data.op_radiology} category="op_radiology"
              refund={refundOf('op_radiology')} showRefund={true}
              onCellClick={openBreakdown} />
          </div>

          {/* Row 2 — Direct Patients (no refund), Direct Diagnostics + Direct Radiology (refund) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CollectionCard icon={UserPlus} theme="green" title="Direct Patients"
              bucket={data.direct_patients} category="direct_patients"
              refund={refundOf('direct_patients')} showRefund={false}
              onCellClick={openBreakdown} />
            <CollectionCard icon={Microscope} theme="green" title="Direct Diagnostics"
              bucket={data.direct_diagnostics} category="direct_diagnostics"
              refund={refundOf('direct_diagnostics')} showRefund={true}
              onCellClick={openBreakdown} />
            <CollectionCard icon={Radio} theme="green" title="Direct Radiology"
              bucket={data.direct_radiology} category="direct_radiology"
              refund={refundOf('direct_radiology')} showRefund={true}
              onCellClick={openBreakdown} />
          </div>

          {/* Row 3 — all three IP cards show refund */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CollectionCard icon={BedDouble} theme="navy" title="IP Income"
              bucket={data.ip_income} category="ip_income"
              refund={refundOf('ip_income')} showRefund={true}
              onCellClick={openBreakdown} />
            <CollectionCard icon={Microscope} theme="navy" title="IP Diagnostics"
              bucket={data.ip_diagnostics} category="ip_diagnostics"
              refund={refundOf('ip_diagnostics')} showRefund={true}
              onCellClick={openBreakdown} />
            <CollectionCard icon={Radio} theme="navy" title="IP Radiology"
              bucket={data.ip_radiology} category="ip_radiology"
              refund={refundOf('ip_radiology')} showRefund={true}
              onCellClick={openBreakdown} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MoneyCard theme="red" title="Total Income" value={data.total_income} />
            <MoneyCard theme="blue" title="Expenses" value={data.expenses} />
            <MoneyCard theme="navy" title="Grand Total" value={data.grand_total} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DueCard due={data.due} />
          </div>
        </div>
      )}

      <BreakdownModal
        open={breakdown.open}
        onClose={closeBreakdown}
        params={breakdown}
        startDate={startDate}
        endDate={endDate}
      />
    </Section>
  )
}