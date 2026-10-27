import { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import { PageHeader, Section } from '../../components/PageHeader'

const MODAL_PAGE_SIZE = 10
const INVOICE_PAGE_SIZE = 10

// Builds: 1 2 3 4 5 ... last  (sliding window)
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 2) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

function Pagination({ page, totalPages, onChange }) {
  const pages = getPageNumbers(page, totalPages)
  const base =
    'min-w-[34px] h-[30px] px-2 flex items-center justify-center border rounded text-xs shadow-sm'
  const idle = 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={`${base} ${idle} disabled:opacity-50 disabled:cursor-not-allowed`}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        &laquo;
      </button>

      {pages.map((p, idx) =>
        p === '...' ? (
          <span key={`dots-${idx}`} className={`${base} ${idle} cursor-default`}>
            …
          </span>
        ) : (
          <button
            type="button"
            key={p}
            className={`${base} font-semibold ${
              page === p ? 'bg-gray-700 text-white border-gray-700' : idle
            }`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        className={`${base} ${idle} disabled:opacity-50 disabled:cursor-not-allowed`}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        &raquo;
      </button>
    </div>
  )
}

export default function InpatientSalesReturns() {
  // ---------- Main search state ----------
  const [regNo, setRegNo] = useState('')
  const [admission, setAdmission] = useState(null)
  const [error, setError] = useState('')
  const [invoices, setInvoices] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  // ---------- Invoice table (client side search + paging) ----------
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoicePage, setInvoicePage] = useState(1)

  // ---------- Modal state ----------
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [modalData, setModalData] = useState([])
  const [modalPage, setModalPage] = useState(1)
  const [modalTotalRecords, setModalTotalRecords] = useState(0)
  const [loadingModal, setLoadingModal] = useState(false)

  const modalTotalPages = Math.max(1, Math.ceil(modalTotalRecords / MODAL_PAGE_SIZE))

  // Debounce the modal search text (and go back to page 1 when it changes)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(modalSearch)
      setModalPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [modalSearch])

  // Fetch modal patients whenever modal is open / page / search changes
  useEffect(() => {
    if (!isModalOpen) return
    let cancelled = false

    const load = async () => {
      setLoadingModal(true)
      try {
        const { data } = await api.get('/pharmacy-sales/search-patients', {
          params: { search: debouncedSearch, page: modalPage, limit: MODAL_PAGE_SIZE },
        })
        if (cancelled) return
        setModalData(data.data || [])
        setModalTotalRecords(data.total || 0)
      } catch (err) {
        if (!cancelled) console.error('Modal fetch error', err)
      } finally {
        if (!cancelled) setLoadingModal(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [isModalOpen, modalPage, debouncedSearch])

  // Close modal on Escape
  useEffect(() => {
    if (!isModalOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setIsModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isModalOpen])

  const openModal = () => {
    setModalSearch('')
    setDebouncedSearch('')
    setModalPage(1)
    setIsModalOpen(true)
  }

  // ---------- Invoices ----------
  const fetchPatientInvoices = async (ipRegNo) => {
    setLoadingInvoices(true)
    setInvoiceSearch('')
    setInvoicePage(1)
    try {
      const { data } = await api.get('/pharmacy-sales', {
        params: { search: ipRegNo, sale_type: 'IP' },
      })
      setInvoices(data)
    } catch (err) {
      console.error('Failed to fetch invoices', err)
      setInvoices([])
    } finally {
      setLoadingInvoices(false)
    }
  }

  const selectPatientFromModal = (patient) => {
    setError('')
    setRegNo(patient.ip_reg_no)
    setAdmission(patient)
    setIsModalOpen(false)
    fetchPatientInvoices(patient.ip_reg_no)
  }

  // ---------- Main search (type + Enter / Search button) ----------
  const handleSearch = async () => {
    setError('')
    setInvoices([])
    setAdmission(null)
    if (!regNo.trim()) return

    try {
      const { data } = await api.get('/ip-registrations', { params: { search: regNo } })
      const match = data.find((r) => r.ip_reg_no === regNo || r.mr_number === regNo)

      if (!match) {
        setError('No matching admitted patient found for this Reg No.')
        return
      }
      setAdmission(match)
      fetchPatientInvoices(match.ip_reg_no)
    } catch {
      setError('Could not look up patient')
    }
  }

  // ---------- Invoice table filtering / paging ----------
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter((inv) =>
      [inv.sale_no, inv.created_by_name, new Date(inv.created_at).toLocaleString()]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [invoices, invoiceSearch])

  const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoices.length / INVOICE_PAGE_SIZE))
  const pagedInvoices = filteredInvoices.slice(
    (invoicePage - 1) * INVOICE_PAGE_SIZE,
    invoicePage * INVOICE_PAGE_SIZE
  )
  const invFrom = filteredInvoices.length === 0 ? 0 : (invoicePage - 1) * INVOICE_PAGE_SIZE + 1
  const invTo = Math.min(invoicePage * INVOICE_PAGE_SIZE, filteredInvoices.length)

  const modalFrom = modalTotalRecords === 0 ? 0 : (modalPage - 1) * MODAL_PAGE_SIZE + 1
  const modalTo = Math.min(modalPage * MODAL_PAGE_SIZE, modalTotalRecords)

  return (
    <div>
      <PageHeader title="Inpatient Sales Returns" />

      {error && (
        <div className="text-sm text-danger-500 bg-danger-400/10 border border-danger-400/30 rounded-sm px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {/* ================= Top Search Section ================= */}
      <Section title="Search By Invoice No. / Patient Reg.No. To Get Details">
        <div className="flex items-center gap-4 max-w-2xl">
          <label className="label mb-0 whitespace-nowrap">PATIENT REG.NO :</label>
          <div className="relative flex-1">
            <input
              className="input pr-10 cursor-pointer"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              onClick={openModal}
              placeholder="Click to search patient..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black"
              onClick={openModal}
            >
              🔍
            </button>
          </div>
          <button type="button" className="btn-primary" onClick={handleSearch}>
            Search
          </button>
        </div>
      </Section>

      {/* ================= Patient Details ================= */}
      {admission && (
        <Section title="Patient Details">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="label">Registration#</label>
              <input className="input bg-gray-50" readOnly value={admission.ip_reg_no || ''} />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input bg-gray-50" readOnly value={admission.name || ''} />
            </div>
            <div>
              <label className="label">Mobile#</label>
              <input className="input bg-gray-50" readOnly value={admission.mobile || ''} />
            </div>
            <div>
              <label className="label">Gender/Age</label>
              <input
                className="input bg-gray-50"
                readOnly
                value={`${admission.gender || ''} / ${admission.age || ''}Y`}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Doctor</label>
              <input className="input bg-gray-50" readOnly value={admission.doctor_name || ''} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Floor/Room Type/Room No/Bed No</label>
              <input
                className="input bg-gray-50"
                readOnly
                value={`${admission.floor || ''} / ${admission.room_type || ''} / ${admission.room_no || ''} / ${admission.bed_no || ''}`}
              />
            </div>
          </div>
        </Section>
      )}

      {/* ================= Invoices Table ================= */}
      <div className="mt-6 border border-border rounded-sm bg-white">
        <div className="p-3 border-b border-border flex justify-end items-center">
          <label className="text-sm font-semibold mr-2 text-gray-700">Search:</label>
          <input
            type="text"
            className="input max-w-xs"
            value={invoiceSearch}
            onChange={(e) => {
              setInvoiceSearch(e.target.value)
              setInvoicePage(1)
            }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#2c8bbb] text-white">
              <tr>
                <th className="px-4 py-3 font-medium">MR Number</th>
                <th className="px-4 py-3 font-medium">Invoice No</th>
                <th className="px-4 py-3 font-medium">Patient Reg No.</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">InvoiceBy</th>
                <th className="px-4 py-3 font-medium">InvoiceAt</th>
              </tr>
            </thead>
            <tbody>
              {loadingInvoices ? (
                <tr>
                  <td colSpan="7" className="text-center py-4">
                    Loading invoices...
                  </td>
                </tr>
              ) : pagedInvoices.length > 0 ? (
                pagedInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border hover:bg-gray-50">
                    <td className="px-4 py-3">{admission?.mr_number || 'N/A'}</td>
                    <td className="px-4 py-3">{inv.sale_no}</td>
                    <td className="px-4 py-3">{admission?.ip_reg_no}</td>
                    <td className="px-4 py-3">{admission?.name}</td>
                    <td className="px-4 py-3">{admission?.mobile}</td>
                    <td className="px-4 py-3">{inv.created_by_name || 'Admin'}</td>
                    <td className="px-4 py-3">{new Date(inv.created_at).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-4 py-6 text-center text-gray-500">
                    {admission
                      ? 'No invoices found for this patient.'
                      : 'Search a patient to view invoices.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-border flex justify-between items-center text-sm">
          <span className="text-gray-600 text-xs">
            Showing {invFrom} to {invTo} of {filteredInvoices.length.toLocaleString()} entries
          </span>
          <Pagination page={invoicePage} totalPages={invoiceTotalPages} onChange={setInvoicePage} />
        </div>
      </div>

      {/* ================= PATIENT SEARCH MODAL (matches screenshot) ================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-10 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative bg-white w-full max-w-[1125px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Faint close x (top-right) */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-1 right-2 text-gray-300 hover:text-gray-500 text-xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>

            {/* Search row */}
            <div className="flex justify-end items-center px-8 pt-8 pb-2">
              <label className="text-sm font-bold text-gray-800 mr-2">Search:</label>
              <input
                type="text"
                className="border border-blue-400 px-2 py-1 text-sm outline-none focus:border-blue-600 w-[190px]"
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Table */}
            <div className="px-8 max-h-[65vh] overflow-y-auto">
              <table className="w-full text-left text-[14px]">
                <thead className="sticky top-0">
                  <tr>
                    <th className="bg-[#4da3d9] text-white px-3 py-2 font-semibold w-[20%] border-r border-white/70">
                      MR Number
                    </th>
                    <th className="bg-[#4da3d9] text-white px-3 py-2 font-semibold w-[24%] border-r border-white/70">
                      Patient Reg No.
                    </th>
                    <th className="bg-[#4da3d9] text-white px-3 py-2 font-semibold w-[34%] border-r border-white/70">
                      Name
                    </th>
                    <th className="bg-[#4da3d9] text-white px-3 py-2 font-semibold w-[22%]">
                      Contact
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loadingModal ? (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-gray-500">
                        Loading patients...
                      </td>
                    </tr>
                  ) : modalData.length > 0 ? (
                    modalData.map((pt, idx) => (
                      <tr
                        key={pt.id}
                        className={`cursor-pointer hover:bg-[#e6f2fa] ${
                          idx % 2 === 0 ? 'bg-white' : 'bg-[#f3f3f3]'
                        }`}
                        onClick={() => selectPatientFromModal(pt)}
                      >
                        <td className="px-3 py-1.5 text-gray-800">{pt.mr_number || 'N/A'}</td>
                        <td className="px-3 py-1.5 text-gray-800">{pt.ip_reg_no}</td>
                        <td className="px-3 py-1.5 text-gray-800 uppercase">{pt.name}</td>
                        <td className="px-3 py-1.5 text-gray-800">{pt.mobile}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-gray-500">
                        No patients found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer: entries + pagination */}
            <div className="flex justify-between items-center px-8 pt-3 pb-8">
              <span className="text-gray-700 text-sm">
                Showing {modalFrom} to {modalTo} of {modalTotalRecords.toLocaleString()} entries
              </span>
              <Pagination page={modalPage} totalPages={modalTotalPages} onChange={setModalPage} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}