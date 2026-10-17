import { useEffect, useRef, useState } from 'react'
import { Plus, Search, Edit, Trash2, X, ChevronDown } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { supplierApi, inventoryTypeApi } from '../../api/axios'

export default function SupplierMaster() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const fetchSuppliers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await supplierApi.getAll({ search, page, limit })
      const list = Array.isArray(res) ? res : (res?.data ?? [])
      setSuppliers(list)
      setTotal(Number(res?.total) || 0)
      setTotalPages(Number(res?.total_pages) || 1)
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to load suppliers'
      setError(msg)
      setSuppliers([])
      setTotal(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchSuppliers, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, limit])

  useEffect(() => { setPage(1) }, [search, limit])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier?')) return
    try {
      await supplierApi.delete(id)
      if ((suppliers ?? []).length === 1 && page > 1) setPage((p) => p - 1)
      else fetchSuppliers()
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed')
    }
  }

  const handleExport = () => {
    if (!suppliers.length) { alert('Nothing to export'); return }
    const headers = ['Supplier', 'Contact Person', 'Contact No', 'Email', 'GST No', 'Inventory Type', 'IsActive']
    const rows = suppliers.map(s => [
      s.name, s.contact_person || '', s.contact_no || '',
      s.email || '', s.gst_no || '', s.inventory_type || '',
      s.is_active ? 'true' : 'false',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `suppliers_${new Date().toISOString().slice(0, 10)}.csv`
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
      <PageHeader title="Supplier" subtitle="Manage vendor / supplier details" />

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 mt-2">
        <button
          onClick={() => { setEditingId(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#5B9BD5] hover:bg-[#4a8ac0] text-white text-sm font-medium rounded-sm transition-colors"
        >
          <Plus size={16} />
          Add Supplier
        </button>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-[#E15B5B] hover:bg-[#c94a4a] text-white text-sm font-medium rounded-sm"
          >
            Export
          </button>
          <div className="flex items-center gap-2">
            <span>Search:</span>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5] w-56 sm:w-72"
                placeholder="Supplier/ContactNO"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#5B9BD5] text-white">
            <tr>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Contact Number</th>
              <th className="px-4 py-3 font-medium">Email Id</th>
              <th className="px-4 py-3 font-medium">Inventory Type</th>
              <th className="px-4 py-3 font-medium w-24">IsActive</th>
              <th className="px-4 py-3 font-medium w-20 text-center">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : (suppliers ?? []).length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No suppliers found.</td></tr>
            ) : (
              suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-800">{s.name}</td>
                  <td className="px-4 py-2.5 text-gray-800">{s.contact_no || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-800">{s.email || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-800">{s.inventory_type || '—'}</td>
                  <td className="px-4 py-2.5">
                    {s.is_active ? (
                      <span className="text-green-600 font-medium">true</span>
                    ) : (
                      <span className="text-gray-400 font-medium">false</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => { setEditingId(s.id); setShowModal(true) }}
                        className="text-blue-500 hover:text-blue-700"
                        title="Edit"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
          <div className="text-gray-600">
            Showing <span className="font-medium">{startRow}</span> to{' '}
            <span className="font-medium">{endRow}</span> of{' '}
            <span className="font-medium">{safeTotal}</span> entries
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-2 py-1 border border-gray-300 rounded-sm bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-100"
            >
              «
            </button>

            {getPageNumbers().map((p, idx) =>
              p === '...' ? (
                <span key={`e-${idx}`} className="px-2 text-gray-400">…</span>
              ) : (
                <button
                  key={`pg-${p}`}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 border rounded-sm ${
                    p === safePage
                      ? 'bg-[#5B9BD5] text-white border-[#5B9BD5]'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => setPage((p) => Math.min(Number(totalPages) || 1, p + 1))}
              disabled={safePage === Number(totalPages) || Number(totalPages) === 0}
              className="px-2 py-1 border border-gray-300 rounded-sm bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-100"
            >
              »
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <SupplierModal
          supplierId={editingId}
          onClose={() => { setShowModal(false); setEditingId(null); fetchSuppliers() }}
        />
      )}
    </div>
  )
}

// ============================================================
// Multi-select dropdown for Inventory Type
// ============================================================
function InventoryTypeMultiSelect({ options, selectedIds, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggle = (id) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    )
  }

  // Build the button label
  const selectedNames = options
    .filter((o) => selectedIds.includes(o.id))
    .map((o) => o.name)

  let label = 'Select options'
  if (selectedNames.length === 1) label = selectedNames[0]
  else if (selectedNames.length === 2) label = selectedNames.join(', ')
  else if (selectedNames.length > 2)
    label = `${selectedNames[0]}, ${selectedNames[1]} (+${selectedNames.length - 2} more)`

  return (
    <div ref={wrapperRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-sm bg-white text-sm text-left focus:outline-none focus:border-[#5B9BD5]"
      >
        <span className={selectedNames.length ? 'text-gray-800' : 'text-gray-500'}>
          {label}
        </span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-[60] mt-1 w-full max-h-56 overflow-y-auto border border-gray-300 rounded-sm bg-white shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Loading inventory types…</div>
          ) : (
            options.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  checked={selectedIds.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                />
                <span>{opt.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Add / Edit Supplier Modal
// ============================================================
function SupplierModal({ supplierId, onClose }) {
  const [form, setForm] = useState({
    name: '',
    inventory_type: '',
    vat_no: '',
    contact_person: '',
    contact_no: '',
    email: '',
    gst_no: '',
    pincode: '',
    address: '',
    fax: '',
    alt_contact_no: '',
    website: '',
    remarks: '',
    apgst_no: '',
    cst_no: '',
    dl_no: '',
    pan_no: '',
    is_active: 'true',
    is_igst_tax: false,
  })
  const [selectedInventoryIds, setSelectedInventoryIds] = useState([])
  const [inventoryTypes, setInventoryTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load all active inventory types
  useEffect(() => {
    inventoryTypeApi.getAllActive()
      .then((data) => setInventoryTypes(Array.isArray(data) ? data : []))
      .catch(() => setInventoryTypes([]))
  }, [])

  // Load supplier if editing
  useEffect(() => {
    if (supplierId) {
      supplierApi.get(supplierId).then((d) => {
        setForm({
          id: d.id,
          name: d.name || '',
          inventory_type: d.inventory_type || '',
          vat_no: d.vat_no || '',
          contact_person: d.contact_person || '',
          contact_no: d.contact_no || '',
          email: d.email || '',
          gst_no: d.gst_no || '',
          pincode: d.pincode || '',
          address: d.address || '',
          fax: d.fax || '',
          alt_contact_no: d.alt_contact_no || '',
          website: d.website || '',
          remarks: d.remarks || '',
          apgst_no: d.apgst_no || '',
          cst_no: d.cst_no || '',
          dl_no: d.dl_no || '',
          pan_no: d.pan_no || '',
          is_active: d.is_active ? 'true' : 'false',
          is_igst_tax: Boolean(d.is_igst_tax),
        })
      }).catch(err => setError(err.response?.data?.error || 'Failed to load supplier'))
    }
  }, [supplierId])

  // Map stored names -> ids once inventoryTypes are loaded
  useEffect(() => {
    if (!supplierId) return
    if (inventoryTypes.length === 0) return
    if (!form.inventory_type) return
    const names = form.inventory_type.split(',').map((s) => s.trim()).filter(Boolean)
    const ids = inventoryTypes.filter((it) => names.includes(it.name)).map((it) => it.id)
    setSelectedInventoryIds(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryTypes, form.inventory_type, supplierId])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Supplier name is required'); return }
    setLoading(true)
    setError('')

    try {
      const selectedNames = inventoryTypes
        .filter((it) => selectedInventoryIds.includes(it.id))
        .map((it) => it.name)

      const payload = {
        ...form,
        inventory_type: selectedNames.join(','),
        is_active: form.is_active === 'true',
        is_igst_tax: Boolean(form.is_igst_tax),
      }

      if (supplierId) await supplierApi.update(payload)
      else await supplierApi.create(payload)

      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            Supplier : {supplierId ? 'Edit' : 'Add'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" noValidate>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {error && (
              <div className="md:col-span-3 text-sm text-red-500 bg-red-50 p-2 rounded-sm border border-red-200">
                {error}
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier <span className="text-red-500">*</span>
              </label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.name} onChange={(e) => update('name', e.target.value)}
                placeholder="Supplier" />
            </div>

            {/* Multi-select dropdown for Inventory Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Inventory Type <span className="text-red-500">*</span>
              </label>
              <InventoryTypeMultiSelect
                options={inventoryTypes}
                selectedIds={selectedInventoryIds}
                onChange={setSelectedInventoryIds}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">VAT NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.vat_no} onChange={(e) => update('vat_no', e.target.value)} placeholder="VATNO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.contact_person} onChange={(e) => update('contact_person', e.target.value)} placeholder="Contact Person" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact No</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.contact_no} onChange={(e) => update('contact_no', e.target.value)} placeholder="Contact No" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email ID <span className="text-red-500">*</span>
              </label>
              <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Email ID" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                GST NO <span className="text-red-500">*</span>
              </label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.gst_no} onChange={(e) => update('gst_no', e.target.value)} placeholder="GST NO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PinCode</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.pincode} onChange={(e) => update('pincode', e.target.value)} placeholder="PinCode" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.address} onChange={(e) => update('address', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.fax} onChange={(e) => update('fax', e.target.value)} placeholder="Fax" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Contact No</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.alt_contact_no} onChange={(e) => update('alt_contact_no', e.target.value)} placeholder="Alternate Contact No" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="Website" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.remarks} onChange={(e) => update('remarks', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">APGST NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.apgst_no} onChange={(e) => update('apgst_no', e.target.value)} placeholder="APGSTNO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CST NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.cst_no} onChange={(e) => update('cst_no', e.target.value)} placeholder="CSTNO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DL NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.dl_no} onChange={(e) => update('dl_no', e.target.value)} placeholder="DLNO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.pan_no} onChange={(e) => update('pan_no', e.target.value)} placeholder="PANNO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Is Active</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5] bg-white"
                value={form.is_active} onChange={(e) => update('is_active', e.target.value)}>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" id="is_igst_tax" className="w-4 h-4"
                checked={form.is_igst_tax} onChange={(e) => update('is_igst_tax', e.target.checked)} />
              <label htmlFor="is_igst_tax" className="text-sm text-gray-700">Is IGST Tax</label>
            </div>
          </div>

          <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-[#5B9BD5] rounded-sm hover:bg-[#4a8ac0] disabled:opacity-50">
              {loading ? 'Saving…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}