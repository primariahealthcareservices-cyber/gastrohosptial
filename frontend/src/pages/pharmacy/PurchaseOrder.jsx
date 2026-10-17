import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, Edit, X, Trash2, AlertCircle } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import {
  purchaseOrderApi, supplierApi, inventoryTypeApi, itemTypeApi, itemApi, manufacturerApi,
} from '../../api/axios'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function SectionHeading({ children, rightContent }) {
  return (
    <div className="flex items-center justify-between bg-[#5B9BD5] text-white px-3 py-2 rounded-sm mb-3">
      <h3 className="text-sm font-semibold">{children}</h3>
      {rightContent}
    </div>
  )
}

// ============================================================
// Autocomplete for Item Name
// ============================================================
function ItemNameAutocomplete({ value, onChange, options, onInvalid, style }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef(null)

  const filtered = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    if (!q) return options.slice(0, 20)
    return options
      .filter((o) => o.name.toLowerCase().includes(q))
      .slice(0, 20)
  }, [value, options])

  useEffect(() => {
    const handle = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        if (value && !options.some((o) => o.name.toLowerCase() === value.trim().toLowerCase())) {
          onInvalid && onInvalid(value)
        }
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [value, options, onInvalid])

  const commitValue = (name) => {
    const match = options.find((o) => o.name.toLowerCase() === name.trim().toLowerCase())
    if (match) {
      onChange(name, match)
    } else {
      onChange(name, null)
      onInvalid && onInvalid(name)
    }
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (filtered[highlight]) {
        e.preventDefault()
        commitValue(filtered[highlight].name)
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'Tab') {
      if (value && !options.some((o) => o.name.toLowerCase() === value.trim().toLowerCase())) {
        onInvalid && onInvalid(value)
      }
    }
  }

  return (
    <div ref={wrapperRef} className="relative" style={style}>
      <input
        className={`w-full border rounded-sm px-2 py-1 text-sm ${
          value && !options.some((o) => o.name.toLowerCase() === value.trim().toLowerCase())
            ? 'border-red-400 bg-red-50'
            : 'border-gray-200'
        }`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value, null)
          setOpen(true)
          setHighlight(0)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Type item name…"
      />

      {open && filtered.length > 0 && (
        <div className="absolute z-[80] mt-1 w-full max-h-48 overflow-y-auto border border-gray-300 rounded-sm bg-white shadow-lg">
          {filtered.map((opt, i) => (
            <div
              key={opt.id || i}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => { e.preventDefault(); commitValue(opt.name) }}
              className={`px-3 py-1.5 text-sm cursor-pointer ${
                i === highlight ? 'bg-[#5B9BD5] text-white' : 'hover:bg-gray-50'
              }`}
            >
              {opt.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PurchaseOrder() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [search, setSearch] = useState('')

  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const fetchRows = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await purchaseOrderApi.getAll({
        search, start_date: startDate, end_date: endDate, page, limit
      })
      const list = Array.isArray(res) ? res : (res?.data ?? [])
      setRows(list)
      setTotal(Number(res?.total) || 0)
      setTotalPages(Number(res?.total_pages) || 1)
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to load POs')
      setRows([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(fetchRows, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, startDate, endDate, page])

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this Purchase Order?')) return
    try {
      await purchaseOrderApi.cancel(id)
      fetchRows()
    } catch (err) {
      alert(err.response?.data?.error || 'Cancel failed')
    }
  }

  const handleExport = () => {
    if (!rows.length) { alert('Nothing to export'); return }
    const headers = ['Valid Till', 'PO Date', 'PO No', 'Inventory Type', 'Supplier', 'Created By', 'Status', 'Net Payable']
    const data = rows.map(r => [
      r.valid_till || '', r.po_date || '', r.po_no || '',
      r.inventory_type || '', r.supplier_name || '',
      r.created_by_name || '', r.status || '', r.net_payable ?? '',
    ])
    const csv = [headers, ...data].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `purchase-orders_${startDate}_to_${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getPageNumbers = () => {
    const pages = []
    const tp = Number(totalPages) || 1
    const cp = Number(page) || 1
    const maxVisible = 5
    if (tp <= maxVisible + 2) {
      for (let i = 1; i <= tp; i++) pages.push(i)
    } else {
      pages.push(1)
      let start = Math.max(2, cp - 1)
      let end = Math.min(tp - 1, cp + 1)
      if (cp <= 3) { start = 2; end = 4 }
      if (cp >= tp - 2) { start = tp - 3; end = tp - 1 }
      if (start > 2) pages.push('...')
      for (let i = start; i <= end; i++) pages.push(i)
      if (end < tp - 1) pages.push('...')
      pages.push(tp)
    }
    return pages
  }

  const safeTotal = Number(total) || 0
  const safeLimit = Number(limit) || 10
  const safePage = Number(page) || 1
  const startRow = safeTotal === 0 ? 0 : (safePage - 1) * safeLimit + 1
  const endRow = Math.min(safePage * safeLimit, safeTotal)

  return (
    <div>
      <PageHeader title="Purchase Order" subtitle="Create and manage purchase orders" />

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm">
        <div className="p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input type="date" value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-sm text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input type="date" value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
              className="px-3 py-2 border border-gray-300 rounded-sm text-sm" />
          </div>
          <button onClick={fetchRows}
            className="px-4 py-2 bg-[#5B9BD5] hover:bg-[#4a8ac0] text-white text-sm font-medium rounded-sm">
            Get In Detail
          </button>
          <button onClick={handleExport}
            className="px-4 py-2 bg-[#E15B5B] hover:bg-[#c94a4a] text-white text-sm font-medium rounded-sm">
            Export
          </button>
        </div>

        <div className="px-4 pb-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button onClick={() => { setEditingId(null); setShowForm(true) }}
            className="px-4 py-2 bg-[#5B9BD5] hover:bg-[#4a8ac0] text-white text-sm font-medium rounded-sm">
            Add New PO
          </button>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Search:</span>
            <div className="relative">
              <input value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5] w-56 sm:w-72" />
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>
          </div>
        </div>

        {error && <div className="px-4 pb-3 text-red-500 text-sm">{error}</div>}

        <table className="w-full text-left text-sm">
          <thead className="bg-[#5B9BD5] text-white">
            <tr>
              <th className="px-4 py-3 font-medium">Valid Till</th>
              <th className="px-4 py-3 font-medium">PO Date</th>
              <th className="px-4 py-3 font-medium">PO No</th>
              <th className="px-4 py-3 font-medium">Inventory Type</th>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Created By</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-center w-16">Edit</th>
              <th className="px-4 py-3 font-medium text-center w-20">Cancel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="9" className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="9" className="px-4 py-8 text-center text-gray-500">Details not available.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">{r.valid_till || '—'}</td>
                  <td className="px-4 py-2.5">{r.po_date || '—'}</td>
                  <td className="px-4 py-2.5">{r.po_no || '—'}</td>
                  <td className="px-4 py-2.5">{r.inventory_type || '—'}</td>
                  <td className="px-4 py-2.5">{r.supplier_name || '—'}</td>
                  <td className="px-4 py-2.5">{r.created_by_name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={r.status === 'Cancelled' ? 'text-red-500' : 'text-green-600'}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => { setEditingId(r.id); setShowForm(true) }}
                      className="text-blue-500 hover:text-blue-700" title="Edit">
                      <Edit size={16} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => handleCancel(r.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium">
                      Cancel
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
          <div className="text-gray-600">
            Showing <span className="font-medium">{startRow}</span> to{' '}
            <span className="font-medium">{endRow}</span> of{' '}
            <span className="font-medium">{safeTotal}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2 py-1 border border-gray-300 rounded-sm bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-100">
              «
            </button>
            {getPageNumbers().map((p, idx) =>
              p === '...' ? (
                <span key={`e-${idx}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button key={`pg-${p}`} onClick={() => setPage(p)}
                  className={`px-3 py-1 border rounded-sm ${
                    p === safePage
                      ? 'bg-[#5B9BD5] text-white border-[#5B9BD5]'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}>{p}</button>
              )
            )}
            <button onClick={() => setPage((p) => Math.min(Number(totalPages) || 1, p + 1))}
              disabled={safePage === Number(totalPages) || Number(totalPages) === 0}
              className="px-2 py-1 border border-gray-300 rounded-sm bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-100">
              »
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <POFormModal
          poId={editingId}
          onClose={() => { setShowForm(false); setEditingId(null); fetchRows() }}
        />
      )}
    </div>
  )
}

// ============================================================
// PO Add/Edit Modal — Inventory Type now populated from API
// ============================================================
function POFormModal({ poId, onClose }) {
  const emptyItem = {
    item_name: '', pack: '', qty: 0, free_qty: 0,
    mrp: 0, rate: 0, mrp_per_tab: 0, rate_per_tab: 0,
    disc_pct: 0, tax_pct: 0, tax_amt: 0,
    amount: 0, total_qty: 0,
  }

  const [form, setForm] = useState({
    po_no: '', po_date: todayISO(), valid_till: '',
    inventory_type: '', supplier_id: '', supplier_phone: '',
    supplier_email: '', supplier_address: '',
    sub_total: 0, overall_disc_pct: 0, overall_disc_amt: 0,
    tax_amount: 0, net_amount: 0, other_charges: 0, net_payable: 0,
    terms_and_conditions: '', credit_period_days: '',
    mode_of_dispatch: '', place_of_delivery: '', payment_terms: '',
    contact_person: '', contact_no_at_delivery: '',
    remarks: '', status: 'Pending',
  })
  const [items, setItems] = useState([{ ...emptyItem }])
  const [suppliers, setSuppliers] = useState([])
  const [inventoryTypes, setInventoryTypes] = useState([])   // ← NEW
  const [itemNames, setItemNames] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [popup, setPopup] = useState(null)

  const [showNewItemModal, setShowNewItemModal] = useState(false)
  const [showNewPackModal, setShowNewPackModal] = useState(false)

  useEffect(() => {
    supplierApi.getAll({ limit: 500 })
      .then((res) => setSuppliers(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => setSuppliers([]))

    // ← Load inventory types from the master
    inventoryTypeApi.getAllActive()
      .then((d) => setInventoryTypes(Array.isArray(d) ? d : []))
      .catch(() => setInventoryTypes([]))

    itemApi.getAllNames()
      .then((d) => {
        const list = Array.isArray(d) ? d : []
        setItemNames(list)
        if (list.length === 0) {
          console.warn('[PO] No items returned from /items-master/all-names (or /pharmacy-items/all-names)')
        }
      })
      .catch((err) => {
        console.error('[PO] Failed to load item names:', err.response?.status, err.response?.data)
        setItemNames([])
      })
  }, [])

  useEffect(() => {
    if (poId) {
      purchaseOrderApi.get(poId).then((d) => {
        setForm({
          po_no: d.po_no || '',
          po_date: d.po_date || todayISO(),
          valid_till: d.valid_till || '',
          inventory_type: d.inventory_type || '',
          supplier_id: d.supplier_id ? String(d.supplier_id) : '',
          supplier_phone: d.supplier_phone || '',
          supplier_email: d.supplier_email || '',
          supplier_address: d.supplier_address || '',
          sub_total: d.sub_total || 0,
          overall_disc_pct: d.overall_disc_pct || 0,
          overall_disc_amt: d.overall_disc_amt || 0,
          tax_amount: d.tax_amount || 0,
          net_amount: d.net_amount || 0,
          other_charges: d.other_charges || 0,
          net_payable: d.net_payable || 0,
          terms_and_conditions: d.terms_and_conditions || '',
          credit_period_days: d.credit_period_days || '',
          mode_of_dispatch: d.mode_of_dispatch || '',
          place_of_delivery: d.place_of_delivery || '',
          payment_terms: d.payment_terms || '',
          contact_person: d.contact_person || '',
          contact_no_at_delivery: d.contact_no_at_delivery || '',
          remarks: d.remarks || '',
          status: d.status || 'Pending',
        })
        if (Array.isArray(d.items) && d.items.length > 0) {
          setItems(d.items.map(it => ({
            item_name: it.item_name || '',
            pack: it.pack || '',
            qty: it.qty || 0,
            free_qty: it.free_qty || 0,
            mrp: it.mrp || 0,
            rate: it.rate || 0,
            mrp_per_tab: it.mrp_per_tab || 0,
            rate_per_tab: it.rate_per_tab || 0,
            disc_pct: it.disc_pct || 0,
            tax_pct: it.tax_pct || 0,
            tax_amt: it.tax_amt || 0,
            amount: it.amount || 0,
            total_qty: (Number(it.qty) || 0) + (Number(it.free_qty) || 0),
          })))
        }
      }).catch((err) => setError(err.response?.data?.error || 'Failed to load PO'))
    } else {
      purchaseOrderApi.nextNo()
        .then((d) => setForm((f) => ({ ...f, po_no: d.po_no || '' })))
        .catch(() => {})
    }
  }, [poId])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSupplierChange = (e) => {
    const id = e.target.value
    const s = suppliers.find((x) => String(x.id) === String(id))
    setForm((f) => ({
      ...f,
      supplier_id: id,
      supplier_phone: s?.contact_no || '',
      supplier_email: s?.email || '',
      supplier_address: s?.address || '',
    }))
  }

  const recalcTotals = (list, overrides = {}) => {
    const st = list.reduce((sum, it) => sum + Number(it.amount || 0), 0)
    const discPct = Number(overrides.overall_disc_pct ?? form.overall_disc_pct) || 0
    const discAmt = (st * discPct) / 100
    const tax = list.reduce((sum, it) => sum + Number(it.tax_amt || 0), 0)
    const net = st - discAmt + tax
    const other = Number(overrides.other_charges ?? form.other_charges) || 0
    const netPayable = net + other

    setForm((f) => ({
      ...f,
      sub_total: st,
      overall_disc_amt: discAmt,
      tax_amount: tax,
      net_amount: net,
      net_payable: netPayable,
      ...overrides,
    }))
  }

  const recomputeRow = (row) => {
    const qty = Number(row.qty) || 0
    const free = Number(row.free_qty) || 0
    const rate = Number(row.rate) || 0
    const discPct = Number(row.disc_pct) || 0
    const taxPct = Number(row.tax_pct) || 0
    const base = qty * rate
    const disc = (base * discPct) / 100
    const netBase = base - disc
    const taxAmt = (netBase * taxPct) / 100
    return {
      ...row,
      amount: netBase + taxAmt,
      tax_amt: taxAmt,
      total_qty: qty + free,
    }
  }

  const updateItem = (idx, field, value) => {
    const copy = [...items]
    copy[idx] = { ...copy[idx], [field]: value }
    copy[idx] = recomputeRow(copy[idx])
    setItems(copy)
    recalcTotals(copy)
  }

  const handleItemNameChange = (idx, name, match) => {
    const copy = [...items]
    copy[idx] = { ...copy[idx], item_name: name }
    if (match) {
      copy[idx].mrp = match.mrp || copy[idx].mrp
      if (match.new_tax_percent != null) copy[idx].tax_pct = match.new_tax_percent
    }
    copy[idx] = recomputeRow(copy[idx])
    setItems(copy)
    recalcTotals(copy)
  }

  const handleInvalidItemName = (name) => {
    setPopup({ message: `Please enter item name correctly.\n"${name}" is not in the item master.` })
  }

  const addItem = () => {
    const copy = [...items, { ...emptyItem }]
    setItems(copy)
    recalcTotals(copy)
  }

  const removeItem = (idx) => {
    if (items.length === 1) return
    const copy = items.filter((_, i) => i !== idx)
    setItems(copy)
    recalcTotals(copy)
  }

  const handleAddNewItem = (newItem) => {
    const copy = [...items, { ...emptyItem, item_name: newItem.name || '' }]
    setItems(copy)
    setItemNames((list) => [...list, { id: `local-${Date.now()}`, name: newItem.name }])
    recalcTotals(copy)
    setShowNewItemModal(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.po_date) { setError('PO Date is required'); return }
    if (!form.supplier_id) { setError('Supplier is required'); return }

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.item_name) continue
      const ok = itemNames.some(
        (o) => o.name.toLowerCase() === it.item_name.trim().toLowerCase()
      )
      if (!ok) {
        setPopup({ message: `Please enter item name correctly.\nRow ${i + 1}: "${it.item_name}" is not in the item master.` })
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      const payload = {
        ...form,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        items: items.filter(it => it.item_name),
      }
      if (poId) await purchaseOrderApi.update(poId, payload)
      else await purchaseOrderApi.create(payload)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-sm shadow-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Purchase Order Form</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" noValidate>
          <div className="px-6 pt-4">
            <SectionHeading>Purchase Order Details</SectionHeading>
            {error && (
              <div className="mb-3 text-sm text-red-500 bg-red-50 p-2 rounded-sm border border-red-200">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500">*</span> Valid Till
                </label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.valid_till} onChange={(e) => update('valid_till', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PO Date</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.po_date} onChange={(e) => update('po_date', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PO NO</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-gray-50"
                  value={form.po_no} onChange={(e) => update('po_no', e.target.value)} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Inventory Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white"
                  value={form.inventory_type} onChange={(e) => update('inventory_type', e.target.value)}>
                  <option value="">Select</option>
                  {inventoryTypes.map((it) => (
                    <option key={it.id} value={it.name}>{it.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500">*</span> Supplier
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white"
                  value={form.supplier_id} onChange={handleSupplierChange}>
                  <option value="">Select</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Phone</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-gray-50"
                  value={form.supplier_phone} readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Email</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-gray-50"
                  value={form.supplier_email} readOnly placeholder="Email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Address</label>
                <textarea rows="1" className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-gray-50"
                  value={form.supplier_address} readOnly />
              </div>
            </div>
          </div>

          <div className="px-6 pt-6">
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={addItem}
                className="px-4 py-2 bg-[#5B9BD5] hover:bg-[#4a8ac0] text-white text-sm font-medium rounded-sm">
                Add New Item to PO
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowNewItemModal(true)}
                  className="px-4 py-2 bg-[#5B9BD5] hover:bg-[#4a8ac0] text-white text-sm font-medium rounded-sm">
                  New Item
                </button>
                <button type="button" onClick={() => setShowNewPackModal(true)}
                  className="px-4 py-2 bg-[#5B9BD5] hover:bg-[#4a8ac0] text-white text-sm font-medium rounded-sm">
                  New Pack
                </button>
              </div>
            </div>

            <SectionHeading>Item Details</SectionHeading>

            <div className="overflow-x-auto border border-gray-200 rounded-sm">
              <table className="w-full text-sm min-w-[1200px]">
                <thead className="bg-[#5B9BD5] text-white">
                  <tr>
                    <th className="px-2 py-2 text-left min-w-[220px]">Item Name</th>
                    <th className="px-2 py-2 text-left w-24">Pack</th>
                    <th className="px-2 py-2 text-right w-20">Qty</th>
                    <th className="px-2 py-2 text-right w-20">Free Qty</th>
                    <th className="px-2 py-2 text-right w-24">MRP(₹)</th>
                    <th className="px-2 py-2 text-right w-24">Rate(₹)</th>
                    <th className="px-2 py-2 text-right w-24">MRP(PerTab)</th>
                    <th className="px-2 py-2 text-right w-24">Rate(PerTab)</th>
                    <th className="px-2 py-2 text-right w-24">Discount(%)</th>
                    <th className="px-2 py-2 text-right w-20">Tax(%)</th>
                    <th className="px-2 py-2 text-right w-24">Tax(₹)</th>
                    <th className="px-2 py-2 text-right w-28">Amount(₹)</th>
                    <th className="px-2 py-2 text-right w-24">Total Qty</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1">
                        <ItemNameAutocomplete
                          value={it.item_name}
                          onChange={(name, match) => handleItemNameChange(idx, name, match)}
                          options={itemNames}
                          onInvalid={handleInvalidItemName}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input className="w-full border border-gray-200 rounded-sm px-2 py-1 text-sm"
                          value={it.pack}
                          onChange={(e) => updateItem(idx, 'pack', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="any"
                          className="w-full border border-gray-200 rounded-sm px-2 py-1 text-sm text-right"
                          value={it.qty}
                          onChange={(e) => updateItem(idx, 'qty', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="any"
                          className="w-full border border-gray-200 rounded-sm px-2 py-1 text-sm text-right"
                          value={it.free_qty}
                          onChange={(e) => updateItem(idx, 'free_qty', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="any"
                          className="w-full border border-gray-200 rounded-sm px-2 py-1 text-sm text-right"
                          value={it.mrp}
                          onChange={(e) => updateItem(idx, 'mrp', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="any"
                          className="w-full border border-gray-200 rounded-sm px-2 py-1 text-sm text-right"
                          value={it.rate}
                          onChange={(e) => updateItem(idx, 'rate', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="any"
                          className="w-full border border-gray-200 rounded-sm px-2 py-1 text-sm text-right"
                          value={it.mrp_per_tab}
                          onChange={(e) => updateItem(idx, 'mrp_per_tab', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="any"
                          className="w-full border border-gray-200 rounded-sm px-2 py-1 text-sm text-right"
                          value={it.rate_per_tab}
                          onChange={(e) => updateItem(idx, 'rate_per_tab', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="any"
                          className="w-full border border-gray-200 rounded-sm px-2 py-1 text-sm text-right"
                          value={it.disc_pct}
                          onChange={(e) => updateItem(idx, 'disc_pct', e.target.value)} />
                      </td>
                      <td className="px-2 py-1">
                        <input type="number" step="any"
                          className="w-full border border-gray-200 rounded-sm px-2 py-1 text-sm text-right"
                          value={it.tax_pct}
                          onChange={(e) => updateItem(idx, 'tax_pct', e.target.value)} />
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700">
                        {(Number(it.tax_amt) || 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700 font-medium">
                        {(Number(it.amount) || 0).toFixed(2)}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700">
                        {Number(it.total_qty) || 0}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button type="button" onClick={() => removeItem(idx)}
                          className="text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-6 pt-6">
            <SectionHeading>Payment Details</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub Total</label>
                <input readOnly className="w-full px-3 py-2 border border-gray-200 rounded-sm text-sm bg-gray-50"
                  value={(Number(form.sub_total) || 0).toFixed(2)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Over All Disc (%)</label>
                <input type="number" step="any"
                  className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.overall_disc_pct}
                  onChange={(e) => {
                    const v = e.target.value
                    update('overall_disc_pct', v)
                    recalcTotals(items, { overall_disc_pct: v })
                  }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Over All Disc Amt</label>
                <input readOnly className="w-full px-3 py-2 border border-gray-200 rounded-sm text-sm bg-gray-50"
                  value={(Number(form.overall_disc_amt) || 0).toFixed(2)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label>
                <input readOnly className="w-full px-3 py-2 border border-gray-200 rounded-sm text-sm bg-gray-50"
                  value={(Number(form.tax_amount) || 0).toFixed(2)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Net Amount</label>
                <input readOnly className="w-full px-3 py-2 border border-gray-200 rounded-sm text-sm bg-gray-50"
                  value={(Number(form.net_amount) || 0).toFixed(2)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Other Charges</label>
                <input type="number" step="any"
                  className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.other_charges}
                  onChange={(e) => {
                    const v = e.target.value
                    update('other_charges', v)
                    recalcTotals(items, { other_charges: v })
                  }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Net Payable</label>
                <input readOnly className="w-full px-3 py-2 border border-gray-200 rounded-sm text-sm bg-gray-50 font-semibold text-[#5B9BD5]"
                  value={(Number(form.net_payable) || 0).toFixed(2)} />
              </div>
            </div>
          </div>

          <div className="px-6 pt-6 pb-4">
            <SectionHeading>Terms And Conditions</SectionHeading>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Period (DAYS)</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.credit_period_days}
                  onChange={(e) => update('credit_period_days', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode Of Dispatch</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.mode_of_dispatch}
                  onChange={(e) => update('mode_of_dispatch', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Place Of Delivery</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.place_of_delivery}
                  onChange={(e) => update('place_of_delivery', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.payment_terms}
                  onChange={(e) => update('payment_terms', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.contact_person}
                  onChange={(e) => update('contact_person', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact No At Delivery</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.contact_no_at_delivery}
                  onChange={(e) => update('contact_no_at_delivery', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                <textarea rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.remarks}
                  onChange={(e) => update('remarks', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-[#5B9BD5] rounded-sm hover:bg-[#4a8ac0] disabled:opacity-50">
              {loading ? 'Saving…' : (poId ? 'Update' : 'Save')}
            </button>
          </div>
        </form>
      </div>

      {showNewItemModal && (
        <AddNewItemModal
          onClose={() => setShowNewItemModal(false)}
          onSave={handleAddNewItem}
        />
      )}
      {showNewPackModal && (
        <NewPackModal onClose={() => setShowNewPackModal(false)} />
      )}

      {popup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setPopup(null) }}>
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-md p-5 border-t-4 border-red-500">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-800 mb-1">Item Not Found</h3>
                <p className="text-sm text-gray-700 whitespace-pre-line">{popup.message}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setPopup(null)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-sm">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Add New Item Modal
// ============================================================
function AddNewItemModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: '', inventory_type: '', manufacturer: '',
    disease: '', item_type: '', hsn_code: '',
    tax_category: '', pack_qty: '', unit: '',
    min_stock_qty: '', is_active: 'true',
  })
  const [inventoryTypes, setInventoryTypes] = useState([])
  const [itemTypes, setItemTypes] = useState([])
  const [manufacturers, setManufacturers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    inventoryTypeApi.getAllActive()
      .then((d) => setInventoryTypes(Array.isArray(d) ? d : []))
      .catch(() => setInventoryTypes([]))

    itemTypeApi.getAll({ limit: 500 })
      .then((res) => setItemTypes(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => setItemTypes([]))

    manufacturerApi.getAll({ limit: 500 })
      .then((res) => setManufacturers(Array.isArray(res) ? res : (res?.data ?? [])))
      .catch(() => setManufacturers([]))
  }, [])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Item Name is required'); return }
    setLoading(true)
    setError('')
    try {
      onSave({ name: form.name.trim(), ...form })
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-sm shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-base font-semibold text-gray-800">Add New Item</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" noValidate>
          <div className="p-6">
            <SectionHeading>Item Details</SectionHeading>
            {error && (
              <div className="mb-3 text-sm text-red-500 bg-red-50 p-2 rounded-sm border border-red-200">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500">*</span> Item Name
                </label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.name} onChange={(e) => update('name', e.target.value)}
                  placeholder="Item Name" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500">*</span> Inventory Type
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white"
                  value={form.inventory_type} onChange={(e) => update('inventory_type', e.target.value)}>
                  <option value="">Select</option>
                  {inventoryTypes.map((it) => (
                    <option key={it.id} value={it.name}>{it.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500">*</span> Manufacturer
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white"
                  value={form.manufacturer} onChange={(e) => update('manufacturer', e.target.value)}>
                  <option value="">Select</option>
                  {manufacturers.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disease</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.disease} onChange={(e) => update('disease', e.target.value)}
                  placeholder="Disease" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500">*</span> Item Type
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white"
                  value={form.item_type} onChange={(e) => update('item_type', e.target.value)}>
                  <option value="">Select</option>
                  {itemTypes.map((it) => (
                    <option key={it.id} value={it.name}>{it.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.hsn_code} onChange={(e) => update('hsn_code', e.target.value)}
                  placeholder="HSN Code" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <span className="text-red-500">*</span> Tax Category
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white"
                  value={form.tax_category} onChange={(e) => update('tax_category', e.target.value)}>
                  <option value="">Select</option>
                  <option value="GST 5%">GST 5%</option>
                  <option value="GST 12%">GST 12%</option>
                  <option value="GST 18%">GST 18%</option>
                  <option value="GST 28%">GST 28%</option>
                  <option value="Exempt">Exempt</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pack Qty</label>
                <input type="number" step="any" className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.pack_qty} onChange={(e) => update('pack_qty', e.target.value)}
                  placeholder="Pack Qty" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.unit} onChange={(e) => update('unit', e.target.value)}
                  placeholder="Unit" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Qty</label>
                <input type="number" step="any" className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                  value={form.min_stock_qty} onChange={(e) => update('min_stock_qty', e.target.value)}
                  placeholder="Min Stock Qty" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Is Active</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm bg-white"
                  value={form.is_active} onChange={(e) => update('is_active', e.target.value)}>
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-[#5B9BD5] rounded-sm hover:bg-[#4a8ac0] disabled:opacity-50">
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// New Pack Modal
// ============================================================
function NewPackModal({ onClose }) {
  const [form, setForm] = useState({ pack_name: '', pack_qty: '' })

  const handleSubmit = (e) => {
    e.preventDefault()
    alert(`Pack "${form.pack_name}" will be saved once you wire the backend.`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-sm shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-base font-semibold text-gray-800">Add New Pack</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pack Name</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                value={form.pack_name}
                onChange={(e) => setForm((f) => ({ ...f, pack_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pack Qty</label>
              <input type="number" step="any" className="w-full px-3 py-2 border border-gray-300 rounded-sm text-sm"
                value={form.pack_qty}
                onChange={(e) => setForm((f) => ({ ...f, pack_qty: e.target.value }))} />
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#5B9BD5] rounded-sm hover:bg-[#4a8ac0]">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}