import { useEffect, useState } from 'react'
import { Search, Plus, Trash2, X } from 'lucide-react'
import api from '../../api/axios'
import { PageHeader, Section } from '../../components/PageHeader'

const today = () => new Date().toISOString().slice(0, 10)

export default function OTIndents() {
  const [view, setView] = useState('list') // 'list' | 'form'
  
  // List state
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // Form state
  const [indentDate, setIndentDate] = useState(today())
  const [raisedFor, setRaisedFor] = useState('')
  const [providedTo, setProvidedTo] = useState('')
  const [remarks, setRemarks] = useState('')
  const [items, setItems] = useState([
    { item_name: '', qty: 0, mrp: 0, rate: 0 }
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/ot-indents', { params: { start_date: startDate, end_date: endDate, search } })
      .then((r) => setRows(r.data))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setIndentDate(today())
    setRaisedFor('')
    setProvidedTo('')
    setRemarks('')
    setItems([{ item_name: '', qty: 0, mrp: 0, rate: 0 }])
    setError('')
  }

  const handleNewIndentClick = () => {
    resetForm()
    setView('form')
  }

  const updateItem = (idx, field, value) => {
    const copy = [...items]
    copy[idx] = { ...copy[idx], [field]: value }
    setItems(copy)
  }

  const addItemRow = () => {
    setItems([...items, { item_name: '', qty: 0, mrp: 0, rate: 0 }])
  }

  const removeItemRow = (idx) => {
    if (items.length === 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.mrp || 0)), 0)

  const submitForm = async (e) => {
    e.preventDefault()
    setError('')
    if (!raisedFor) return setError('Indent Raised For is required')
    
    // Check if at least one valid item is added
    const validItems = items.filter(i => i.item_name.trim() !== '')
    if (validItems.length === 0) return setError('Please add at least one item')

    setSaving(true)
    try {
      await api.post('/ot-indents', {
        indent_date: indentDate,
        indent_raised_for: raisedFor,
        indent_provided_to: providedTo,
        remarks: remarks,
        items: validItems,
        total_amount: totalAmount
      })
      setView('list')
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create indent')
    } finally {
      setSaving(false)
    }
  }

  const markReturn = async (id) => {
    await api.patch(`/ot-indents/${id}/return`)
    load()
  }

  // ==========================================
  // RENDER: LIST VIEW
  // ==========================================
  if (view === 'list') {
    return (
      <div>
        <PageHeader title="OT Indents" />

        <Section title="">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div><label className="label">Start Date</label><input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><label className="label">End Date</label><input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <button className="btn-primary" onClick={load}>Get In Detail</button>
          </div>

          <div className="flex items-center justify-between mb-3">
            <button className="btn-primary flex items-center gap-2" onClick={handleNewIndentClick}>
              <Plus size={16} /> New OT Indent
            </button>
            <div className="flex items-center gap-2 max-w-xs">
              <Search size={14} className="text-ink/40" />
              <input className="input" placeholder="Search" value={search}
                onChange={(e) => setSearch(e.target.value)} onBlur={load} />
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#5B9BD5] text-white">
                <tr>
                  <th className="px-4 py-3 font-medium">Indent Date</th>
                  <th className="px-4 py-3 font-medium">Indent Raised For</th>
                  <th className="px-4 py-3 font-medium">Indent Provided To</th>
                  <th className="px-4 py-3 font-medium">Item Details</th>
                  <th className="px-4 py-3 font-medium">Indent Return</th>
                  <th className="px-4 py-3 font-medium text-center">Print</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Details not available.</td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">{new Date(r.indent_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5">{r.indent_raised_for}</td>
                      <td className="px-4 py-2.5">{r.indent_provided_to || '—'}</td>
                      <td className="px-4 py-2.5">{r.item_details || '—'}</td>
                      <td className="px-4 py-2.5">
                        {r.indent_return === 'Pending' ? (
                          <button className="text-teal-600 text-xs hover:underline" onClick={() => markReturn(r.id)}>Mark Returned</button>
                        ) : (
                          <span className="text-xs text-gray-400">{r.indent_return}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button className="text-gray-400 hover:text-gray-700">🖨</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    )
  }

  // ==========================================
  // RENDER: NEW INDENT FORM VIEW
  // ==========================================
  return (
    <div>
      <PageHeader title="OT Indents" subtitle="Create New Indent" />

      <form onSubmit={submitForm}>
        <Section title="OT Indent Details">
          {error && <div className="mb-4 text-sm text-red-500 bg-red-50 p-2 rounded border border-red-200">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label"><span className="text-red-500">*</span> Indent Raised For</label>
              <select className="input" value={raisedFor} onChange={(e) => setRaisedFor(e.target.value)}>
                <option value="">--Select--</option>
                <option value="OT">OT</option>
                <option value="Ward">Ward</option>
                <option value="ICU">ICU</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
            <div>
              <label className="label"><span className="text-red-500">*</span> Provided To</label>
              <select className="input" value={providedTo} onChange={(e) => setProvidedTo(e.target.value)}>
                <option value="">Select</option>
                <option value="Doctor">Doctor</option>
                <option value="Nurse">Nurse</option>
                <option value="Patient">Patient</option>
              </select>
            </div>
            <div>
              <label className="label"><span className="text-red-500">*</span> Date</label>
              <input type="date" className="input" value={indentDate} onChange={(e) => setIndentDate(e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Item Details">
          <div className="mb-3">
            <button type="button" onClick={addItemRow} className="text-blue-600 font-medium text-sm flex items-center gap-1 hover:underline">
              <Plus size={16} /> Add New
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#5B9BD5] text-white">
                <tr>
                  <th className="px-3 py-3 font-medium w-16">SNo</th>
                  <th className="px-3 py-3 font-medium">Item Name</th>
                  <th className="px-3 py-3 font-medium w-24 text-right">Qty</th>
                  <th className="px-3 py-3 font-medium w-32 text-right">MRP (₹)</th>
                  <th className="px-3 py-3 font-medium w-32 text-right">Rate (₹)</th>
                  <th className="px-3 py-3 font-medium w-32 text-right">Amount (₹)</th>
                  <th className="px-3 py-3 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input className="input w-full" placeholder="Enter item name" value={item.item_name} onChange={(e) => updateItem(idx, 'item_name', e.target.value)} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" className="input w-full text-right" value={item.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" className="input w-full text-right" value={item.mrp} onChange={(e) => updateItem(idx, 'mrp', e.target.value)} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" className="input w-full text-right" value={item.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} />
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-700">
                      {(Number(item.qty) * Number(item.mrp)).toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button type="button" onClick={() => removeItemRow(idx)} className="text-red-500 hover:text-red-700 disabled:opacity-30" disabled={items.length === 1}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Payment Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="label">Total Amount (₹)</label>
              <input className="input bg-gray-50 font-semibold" readOnly value={totalAmount.toFixed(2)} />
            </div>
            <div>
              <label className="label">Remarks</label>
              <textarea className="input" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>
        </Section>

        <div className="flex justify-center gap-4 mt-8 mb-10">
          <button type="submit" className="btn-primary w-32" disabled={saving}>
            {saving ? 'Submitting...' : 'SUBMIT'}
          </button>
          <button type="button" className="btn-secondary w-32" onClick={() => setView('list')}>
            CANCEL
          </button>
        </div>
      </form>
    </div>
  )
}