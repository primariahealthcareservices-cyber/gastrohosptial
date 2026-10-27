import { useEffect, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
// FIXED PATHS: Using ../../../ to go out of the 'masters' folder
import { PageHeader } from '../../../components/PageHeader'
import api, { pharmacyPatientIndentApi } from '../../../api/axios'

// --- Modal Component ---
function Modal({ open, onClose, children, width = 'max-w-4xl' }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 px-4 pt-12" onClick={onClose}>
      <div className={`relative mb-10 w-full ${width} rounded-md bg-white shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-3 top-3 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  )
}

// --- Main Page ---
export default function PharmacyPatientIndents() {
  const [indents, setIndents] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Create Indent Form State
  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState('')
  const [items, setItems] = useState([{ item_name: '', qty: 1 }])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 1. Fetch Indents List
  const fetchIndents = async () => {
    setLoading(true)
    try {
      const res = await pharmacyPatientIndentApi.getAll(search)
      setIndents(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIndents()
  }, [search])

  // 2. Fetch IP Patients for the modal dropdown
  const fetchIPPatients = async () => {
    try {
      const res = await api.get('/pharmacy-op-sales/search-patients', { params: { limit: 100 } })
      setPatients(res.data.data || [])
    } catch (err) {
      console.error("Failed to load patients", err)
    }
  }

  const openCreateModal = () => {
    fetchIPPatients()
    setSelectedPatient('')
    setItems([{ item_name: '', qty: 1 }])
    setIsModalOpen(true)
  }

  // 3. Handle Create Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!selectedPatient) return alert('Please select an IP patient.')
    if (!items.some(i => i.item_name.trim())) return alert('Please add at least one item.')

    setIsSubmitting(true)
    try {
      await pharmacyPatientIndentApi.create({
        ip_registration_id: selectedPatient,
        items: items.filter(i => i.item_name.trim())
      })
      alert('Indent created successfully!')
      setIsModalOpen(false)
      fetchIndents() // Refresh the table
    } catch (err) {
      alert('Failed to create indent: ' + (err.response?.data?.error || err.message))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Helpers for item rows
  const handleItemChange = (index, field, value) => {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it))
  }
  const addItem = () => setItems(prev => [...prev, { item_name: '', qty: 1 }])
  const removeItem = (index) => setItems(prev => prev.filter((_, i) => i !== index))

  return (
    <div className="bg-gray-50 min-h-screen">
      <PageHeader title="Patient Indents" />

      <div className="p-4">
        <div className="bg-white border border-gray-300 rounded-sm">
          
          {/* Header Bar */}
          <div className="flex justify-between items-center px-4 py-3 bg-[#4da3d9] text-white">
            <span className="font-semibold text-sm">Patient Indents List</span>
            <div className="flex items-center gap-4 text-sm">
              <button 
                onClick={openCreateModal}
                className="bg-white text-[#4da3d9] px-3 py-1 rounded-sm flex items-center gap-1 font-semibold hover:bg-gray-100 transition-colors"
              >
                <Plus size={16} /> New Indent
              </button>
              <div className="flex items-center gap-2">
                <span>Search:</span>
                <input 
                  type="text" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="border border-gray-300 text-gray-800 px-2 py-1 outline-none focus:border-blue-500 rounded-sm"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-[#4da3d9] text-white">
                  <th className="px-4 py-2 font-semibold border-r border-white/30 whitespace-nowrap">MR Number</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30 whitespace-nowrap">Patient Name</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30 whitespace-nowrap">Patient Reg No</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30">Medicine Details</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30 whitespace-nowrap">Medication Requested Date</th>
                  <th className="px-4 py-2 font-semibold border-r border-white/30 whitespace-nowrap">Requested By</th>
                  <th className="px-4 py-2 font-semibold text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-6 text-gray-500">Loading...</td></tr>
                ) : indents.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-6 text-gray-500">Details not available.</td></tr>
                ) : (
                  indents.map((indent, idx) => (
                    <tr key={indent.id || idx} className="border-b border-gray-200 hover:bg-blue-50">
                      <td className="px-4 py-2 text-gray-700">{indent.mr_number || 'N/A'}</td>
                      <td className="px-4 py-2 text-gray-700">{indent.patient_name}</td>
                      <td className="px-4 py-2 text-gray-700">{indent.ip_reg_no}</td>
                      <td className="px-4 py-2 text-gray-700">{indent.medicine_details}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {indent.created_at ? new Date(indent.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-2 text-gray-700">{indent.requested_by_name || 'Staff'}</td>
                      <td className="px-4 py-2 text-center">
                        <button className="text-blue-600 hover:underline text-xs font-semibold">View</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer / Pagination */}
          <div className="flex justify-between items-center px-4 py-3 text-sm text-gray-600 bg-gray-50 border-t border-gray-200">
            <span>Showing 0 to {indents.length} of {indents.length} entries</span>
            <div className="flex gap-1">
               <button className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-400 disabled:opacity-50" disabled>&laquo;</button>
               <button className="px-2 py-1 border border-gray-300 rounded bg-white text-gray-400 disabled:opacity-50" disabled>&raquo;</button>
            </div>
          </div>

        </div>
      </div>

      {/* CREATE INDENT MODAL */}
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="px-6 py-5">
          <h2 className="text-lg font-bold mb-4 text-gray-800 border-b pb-2">Create New Patient Indent</h2>
          
          <form onSubmit={handleCreateSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Select IP Patient <span className="text-red-500">*</span></label>
              <select 
                className="w-full border border-gray-300 p-2 text-sm rounded-sm outline-none focus:border-[#4da3d9]"
                value={selectedPatient}
                onChange={(e) => setSelectedPatient(e.target.value)}
                required
              >
                <option value="">-- Select Patient --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.ip_reg_no})</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Medicines Required <span className="text-red-500">*</span></label>
              
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input 
                    type="text" 
                    placeholder="Medicine Name" 
                    className="flex-1 border border-gray-300 p-2 text-sm rounded-sm outline-none focus:border-[#4da3d9]"
                    value={item.item_name}
                    onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                  />
                  <input 
                    type="number" 
                    min="1"
                    className="w-20 border border-gray-300 p-2 text-sm rounded-sm outline-none focus:border-[#4da3d9] text-center"
                    value={item.qty}
                    onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                  />
                  <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 px-2">
                    <X size={18} />
                  </button>
                </div>
              ))}
              
              <button type="button" onClick={addItem} className="text-[#4da3d9] text-sm font-semibold flex items-center gap-1 hover:underline mt-2">
                <Plus size={14} /> Add Another Item
              </button>
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t pt-4">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-200 rounded-sm hover:bg-gray-300"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-6 py-2 text-sm font-semibold text-white bg-[#1a4f76] rounded-sm hover:bg-[#153f5e] disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Create Indent'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

    </div>
  )
}