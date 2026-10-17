import { useEffect, useRef, useState } from 'react'
import { Plus, Search, Edit, Trash2, X, ChevronDown } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { manufacturerApi, inventoryTypeApi } from '../../api/axios'

// Reusable multi-select dropdown (same behavior as Supplier page)
function InventoryTypeMultiSelect({ options, selectedIds, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggle = (id) => {
    onChange(selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id])
  }

  const selectedNames = options.filter((o) => selectedIds.includes(o.id)).map((o) => o.name)
  let label = 'Select options'
  if (selectedNames.length === 1) label = selectedNames[0]
  else if (selectedNames.length === 2) label = selectedNames.join(', ')
  else if (selectedNames.length > 2)
    label = `${selectedNames[0]}, ${selectedNames[1]} (+${selectedNames.length - 2} more)`

  return (
    <div ref={wrapperRef} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-sm bg-white text-sm text-left focus:outline-none focus:border-[#5B9BD5]">
        <span className={selectedNames.length ? 'text-gray-800' : 'text-gray-500'}>{label}</span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-[60] mt-1 w-full max-h-56 overflow-y-auto border border-gray-300 rounded-sm bg-white shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Loading inventory types…</div>
          ) : (
            options.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" className="w-4 h-4"
                  checked={selectedIds.includes(opt.id)}
                  onChange={() => toggle(opt.id)} />
                <span>{opt.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function ManufacturerMaster() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const fetchRows = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await manufacturerApi.getAll({ search, page, limit })
      const list = Array.isArray(res) ? res : (res?.data ?? [])
      setRows(list)
      setTotal(Number(res?.total) || 0)
      setTotalPages(Number(res?.total_pages) || 1)
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to load manufacturers'
      setError(msg)
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
  }, [search, page, limit])

  useEffect(() => { setPage(1) }, [search, limit])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this manufacturer?')) return
    try {
      await manufacturerApi.delete(id)
      if ((rows ?? []).length === 1 && page > 1) setPage((p) => p - 1)
      else fetchRows()
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed')
    }
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
      <PageHeader title="Manufacture" subtitle="Manage manufacturers" />

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 mt-2">
        <button
          onClick={() => { setEditingId(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#5B9BD5] hover:bg-[#4a8ac0] text-white text-sm font-medium rounded-sm transition-colors"
        >
          <Plus size={16} />
          Add Manufacture
        </button>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Search:</span>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5] w-64 sm:w-72"
              placeholder="Manufacture/ContactNO"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          </div>
        </div>
      </div>

      {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-sm overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#5B9BD5] text-white">
            <tr>
              <th className="px-4 py-3 font-medium">Manufacture</th>
              <th className="px-4 py-3 font-medium">Contact Number</th>
              <th className="px-4 py-3 font-medium w-24">IsActive</th>
              <th className="px-4 py-3 font-medium w-20 text-center">Edit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : (rows ?? []).length === 0 ? (
              <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">No manufacturers found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-800">{r.name}</td>
                  <td className="px-4 py-2.5 text-gray-800">{r.contact_no || '—'}</td>
                  <td className="px-4 py-2.5">
                    {r.is_active ? (
                      <span className="text-green-600 font-medium">true</span>
                    ) : (
                      <span className="text-gray-400 font-medium">false</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => { setEditingId(r.id); setShowModal(true) }}
                        className="text-blue-500 hover:text-blue-700" title="Edit">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(r.id)}
                        className="text-red-500 hover:text-red-700" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
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
                  }`}>
                  {p}
                </button>
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

      {showModal && (
        <ManufacturerModal
          manufacturerId={editingId}
          onClose={() => { setShowModal(false); setEditingId(null); fetchRows() }}
        />
      )}
    </div>
  )
}

// ============================================================
// Add / Edit Manufacturer Modal
// ============================================================
function ManufacturerModal({ manufacturerId, onClose }) {
  const [form, setForm] = useState({
    name: '',
    short_name: '',
    inventory_type: '',
    tax_category: '',
    contact_person: '',
    contact_no: '',
    pincode: '',
    fax: '',
    address: '',
    alt_contact_no: '',
    email: '',
    website: '',
    remarks: '',
    apgst_no: '',
    cst_no: '',
    gst_no: '',
    dl_no: '',
    pan_no: '',
    is_active: 'true',
  })
  const [selectedInventoryIds, setSelectedInventoryIds] = useState([])
  const [inventoryTypes, setInventoryTypes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    inventoryTypeApi.getAllActive()
      .then((data) => setInventoryTypes(Array.isArray(data) ? data : []))
      .catch(() => setInventoryTypes([]))
  }, [])

  useEffect(() => {
    if (manufacturerId) {
      manufacturerApi.get(manufacturerId).then((d) => {
        setForm({
          id: d.id,
          name: d.name || '',
          short_name: d.short_name || '',
          inventory_type: d.inventory_type || '',
          tax_category: d.tax_category || '',
          contact_person: d.contact_person || '',
          contact_no: d.contact_no || '',
          pincode: d.pincode || '',
          fax: d.fax || '',
          address: d.address || '',
          alt_contact_no: d.alt_contact_no || '',
          email: d.email || '',
          website: d.website || '',
          remarks: d.remarks || '',
          apgst_no: d.apgst_no || '',
          cst_no: d.cst_no || '',
          gst_no: d.gst_no || '',
          dl_no: d.dl_no || '',
          pan_no: d.pan_no || '',
          is_active: d.is_active ? 'true' : 'false',
        })
      }).catch((err) => setError(err.response?.data?.error || 'Failed to load manufacturer'))
    }
  }, [manufacturerId])

  useEffect(() => {
    if (!manufacturerId) return
    if (inventoryTypes.length === 0) return
    if (!form.inventory_type) return
    const names = form.inventory_type.split(',').map((s) => s.trim()).filter(Boolean)
    const ids = inventoryTypes.filter((it) => names.includes(it.name)).map((it) => it.id)
    setSelectedInventoryIds(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryTypes, form.inventory_type, manufacturerId])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Manufacture name is required'); return }
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
      }

      if (manufacturerId) await manufacturerApi.update(payload)
      else await manufacturerApi.create(payload)

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
      <div className="bg-white rounded-sm shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">
            Manufacture : {manufacturerId ? 'Edit' : 'Add'}
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
                Manufacture <span className="text-red-500">*</span>
              </label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.name} onChange={(e) => update('name', e.target.value)}
                placeholder="Manufacture" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Short Name</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.short_name} onChange={(e) => update('short_name', e.target.value)}
                placeholder="Short Name" />
            </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Category</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5] bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.contact_person} onChange={(e) => update('contact_person', e.target.value)}
                placeholder="Contact Person" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact No</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.contact_no} onChange={(e) => update('contact_no', e.target.value)}
                placeholder="Contact No" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PinCode</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.pincode} onChange={(e) => update('pincode', e.target.value)}
                placeholder="PinCode" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fax</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.fax} onChange={(e) => update('fax', e.target.value)}
                placeholder="Fax" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.address} onChange={(e) => update('address', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Contact No</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.alt_contact_no} onChange={(e) => update('alt_contact_no', e.target.value)}
                placeholder="Alternate Contact No" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email ID</label>
              <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.email} onChange={(e) => update('email', e.target.value)}
                placeholder="Email ID" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.website} onChange={(e) => update('website', e.target.value)}
                placeholder="Website" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.remarks} onChange={(e) => update('remarks', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">APGST NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.apgst_no} onChange={(e) => update('apgst_no', e.target.value)}
                placeholder="APGST NO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CST NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.cst_no} onChange={(e) => update('cst_no', e.target.value)}
                placeholder="CST NO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">GST NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.gst_no} onChange={(e) => update('gst_no', e.target.value)}
                placeholder="GST NO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DL NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.dl_no} onChange={(e) => update('dl_no', e.target.value)}
                placeholder="DL NO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN NO</label>
              <input className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                value={form.pan_no} onChange={(e) => update('pan_no', e.target.value)}
                placeholder="PAN NO" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Is Active</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5] bg-white"
                value={form.is_active} onChange={(e) => update('is_active', e.target.value)}>
                <option value="true">True</option>
                <option value="false">False</option>
              </select>
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