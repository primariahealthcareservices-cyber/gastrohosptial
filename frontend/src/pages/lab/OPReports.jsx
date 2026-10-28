import { useEffect, useState } from 'react'
import { Search, Eye, Pencil, Save, X, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../../api/axios'
import { PageHeader, StatusBadge } from '../../components/PageHeader'

const ITEMS_PER_PAGE = 30

export default function OPReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [status, setStatus] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // View modal
  const [selectedReport, setSelectedReport] = useState(null)
  const [showModal, setShowModal] = useState(false)

  // Entry modal
  const [showEntry, setShowEntry] = useState(false)
  const [entryHeader, setEntryHeader] = useState(null)
  const [entryAttrs, setEntryAttrs] = useState([])
  const [entryLoading, setEntryLoading] = useState(false)
  const [entrySaving, setEntrySaving] = useState(false)
  const [entryError, setEntryError] = useState('')

  // ------------------------------------------------------------
  // PAGINATION DERIVED VALUES
  // ------------------------------------------------------------
  const totalPages = Math.max(1, Math.ceil(reports.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE
  const paginatedReports = reports.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // Keep currentPage in range if data shrinks
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [totalPages, currentPage])

  // ------------------------------------------------------------
  // LIST
  // ------------------------------------------------------------
  const fetchReports = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (status) params.append('status', status)
      const { data } = await api.get(`/lab-reports/op?${params.toString()}`)
      setReports(data || [])
      setCurrentPage(1) // reset to first page on new fetch
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilter = (e) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchReports()
  }

  const resetFilter = () => {
    setSearch('')
    setStartDate('')
    setEndDate('')
    setStatus('')
    setCurrentPage(1)
    setTimeout(fetchReports, 0)
  }

  // ------------------------------------------------------------
  // VIEW REPORT
  // ------------------------------------------------------------
  const viewReport = async (report) => {
    try {
      const { data } = await api.get(`/lab-reports/${report.id}/detail?table=op`)
      setSelectedReport({ ...report, _detail: data })
      setShowModal(true)
    } catch (err) {
      console.error(err)
      setSelectedReport(report)
      setShowModal(true)
    }
  }

  // ------------------------------------------------------------
  // ENTER / EDIT RESULT
  // ------------------------------------------------------------
  const openEntry = async (report) => {
    setEntryError('')
    setEntryLoading(true)
    setShowEntry(true)
    try {
      const { data } = await api.get(`/lab-reports/${report.id}/detail?table=op`)
      setEntryHeader(data.header)
      setEntryAttrs(
        (data.attributes || []).map((a) => ({
          ...a,
          result_value: a.result_value || '',
        }))
      )
    } catch (err) {
      console.error(err)
      setEntryError('Failed to load report details')
    } finally {
      setEntryLoading(false)
    }
  }

  const updateAttrResult = (idx, value) =>
    setEntryAttrs((list) =>
      list.map((a, i) => (i === idx ? { ...a, result_value: value } : a))
    )

  const saveEntry = async () => {
    if (!entryHeader?.id) return
    setEntrySaving(true)
    setEntryError('')
    try {
      await api.post(`/lab-reports/${entryHeader.id}/values`, {
        table: 'op',
        mark_in_progress: true,
        values: entryAttrs.map((a) => ({
          lab_attribute_id: a.lab_attribute_id,
          attribute_name: a.attribute_name,
          result_value: a.result_value,
          normal_range: a.normal_range,
          unit: a.unit,
        })),
      })
      setShowEntry(false)
      fetchReports()
    } catch (err) {
      console.error(err)
      setEntryError(err?.response?.data?.error || 'Failed to save')
    } finally {
      setEntrySaving(false)
    }
  }

  // ------------------------------------------------------------
  // STATUS
  // ------------------------------------------------------------
  const updateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/lab-reports/${id}/status`, {
        status: newStatus,
        table: 'op',
      })
      fetchReports()
      if (selectedReport) setSelectedReport({ ...selectedReport, status: newStatus })
    } catch (err) {
      alert('Failed to update status')
    }
  }

  // ------------------------------------------------------------
  // PAGINATION HANDLERS
  // ------------------------------------------------------------
  const goToPage = (page) => {
    const p = Math.max(1, Math.min(page, totalPages))
    setCurrentPage(p)
    // scroll table into view
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ------------------------------------------------------------
  // PAGE NUMBERS (window of up to 5)
  // ------------------------------------------------------------
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(1, safePage - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div>
      <PageHeader
        title="OP Lab Reports"
        subtitle="View and manage outpatient lab reports"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input
            className="input"
            placeholder="By test, patient, OPD No..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Verified">Verified</option>
          </select>
        </div>
        <button
          onClick={handleFilter}
          className="btn-primary flex items-center gap-2"
        >
          <Search size={16} /> Apply
        </button>
        <button onClick={resetFilter} className="btn-secondary">
          Reset
        </button>
      </div>

      {loading && <div className="text-center py-4">Loading...</div>}
      {!loading && reports.length === 0 && (
        <div className="text-center py-8 text-ink/50">No reports found.</div>
      )}

      {!loading && reports.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>OPD No</th>
                  <th>Patient</th>
                  <th>MR No</th>
                  <th>Test Name</th>
                  <th>Status</th>
                  <th>Report Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map((r) => (
                  <tr key={r.id}>
                    <td>{r.opd_reg_no}</td>
                    <td>{r.patient_name}</td>
                    <td>{r.mr_number}</td>
                    <td>{r.test_name}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      {r.report_date
                        ? new Date(r.report_date).toLocaleDateString()
                        : '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openEntry(r)}
                          title="Enter Result"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => viewReport(r)}
                          title="View"
                          className="text-teal-600 hover:text-teal-800"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---------------- PAGINATION ---------------- */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
            <div className="text-sm text-ink/60">
              Showing <strong>{startIndex + 1}</strong>–
              <strong>{Math.min(startIndex + ITEMS_PER_PAGE, reports.length)}</strong>{' '}
              of <strong>{reports.length}</strong> reports
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(safePage - 1)}
                disabled={safePage === 1}
                className="px-2 py-1 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1"
              >
                <ChevronLeft size={14} /> Prev
              </button>

              {getPageNumbers()[0] > 1 && (
                <>
                  <button
                    onClick={() => goToPage(1)}
                    className="px-3 py-1 rounded border border-gray-300 text-sm hover:bg-gray-50"
                  >
                    1
                  </button>
                  {getPageNumbers()[0] > 2 && (
                    <span className="px-1 text-ink/40">…</span>
                  )}
                </>
              )}

              {getPageNumbers().map((p) => (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={`px-3 py-1 rounded border text-sm ${
                    p === safePage
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}

              {getPageNumbers().slice(-1)[0] < totalPages && (
                <>
                  {getPageNumbers().slice(-1)[0] < totalPages - 1 && (
                    <span className="px-1 text-ink/40">…</span>
                  )}
                  <button
                    onClick={() => goToPage(totalPages)}
                    className="px-3 py-1 rounded border border-gray-300 text-sm hover:bg-gray-50"
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                onClick={() => goToPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="px-2 py-1 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ---------------- VIEW MODAL ---------------- */}
      {showModal && selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Report Details</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-ink/50 hover:text-ink text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-medium">Patient</label>
                  <p>{selectedReport.patient_name}</p>
                </div>
                <div>
                  <label className="font-medium">MR No</label>
                  <p>{selectedReport.mr_number}</p>
                </div>
                <div>
                  <label className="font-medium">OPD No</label>
                  <p>{selectedReport.opd_reg_no}</p>
                </div>
                <div>
                  <label className="font-medium">Test Name</label>
                  <p>{selectedReport.test_name}</p>
                </div>
                <div>
                  <label className="font-medium">Status</label>
                  <select
                    className="input mt-1"
                    value={selectedReport.status}
                    onChange={(e) => updateStatus(selectedReport.id, e.target.value)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Verified">Verified</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium">Report Date</label>
                  <p>
                    {selectedReport.report_date
                      ? new Date(selectedReport.report_date).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
              </div>

              {selectedReport._detail?.attributes?.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Parameters</h3>
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Investigation</th>
                        <th>Result</th>
                        <th>Reference Value</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReport._detail.attributes.map((a, i) => (
                        <tr key={i}>
                          <td>{a.attribute_name}</td>
                          <td className="font-medium">{a.result_value || '—'}</td>
                          <td>{a.normal_range || '—'}</td>
                          <td>{a.unit || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- ENTRY MODAL ---------------- */}
      {showEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                Enter Result — {entryHeader?.test_name || ''}
              </h2>
              <button
                onClick={() => setShowEntry(false)}
                className="text-ink/50 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {entryHeader && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-ink/60">Patient: </span>
                    <strong>{entryHeader.patient_name}</strong>
                  </div>
                  <div>
                    <span className="text-ink/60">MR No: </span>
                    <strong>{entryHeader.mr_number}</strong>
                  </div>
                  <div>
                    <span className="text-ink/60">OPD No: </span>
                    <strong>{entryHeader.reg_no}</strong>
                  </div>
                </div>
              )}

              {entryError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
                  {entryError}
                </div>
              )}

              {entryLoading && <div className="py-6 text-center">Loading...</div>}

              {!entryLoading && entryAttrs.length === 0 && (
                <div className="py-6 text-center text-ink/50">
                  No parameters defined for this test.
                </div>
              )}

              {!entryLoading && entryAttrs.length > 0 && (
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Investigation / Parameter Name</th>
                      <th className="w-[220px]">Result</th>
                      <th className="w-[180px]">Reference Value</th>
                      <th className="w-[140px]">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryAttrs.map((a, idx) => {
                      const opts = Array.isArray(a.options)
                        ? a.options
                        : typeof a.options === 'string' && a.options
                        ? JSON.parse(a.options)
                        : []
                      return (
                        <tr key={idx}>
                          <td className="font-medium">{a.attribute_name}</td>
                          <td>
                            {opts.length > 0 ? (
                              <select
                                className="input"
                                value={a.result_value}
                                onChange={(e) =>
                                  updateAttrResult(idx, e.target.value)
                                }
                              >
                                <option value="">Select</option>
                                {opts.map((o, i) => (
                                  <option key={i} value={o}>
                                    {o}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className="input"
                                value={a.result_value}
                                onChange={(e) =>
                                  updateAttrResult(idx, e.target.value)
                                }
                                placeholder="Enter result"
                              />
                            )}
                          </td>
                          <td>{a.normal_range || '—'}</td>
                          <td>{a.unit || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowEntry(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={saveEntry}
                disabled={entrySaving}
                className="btn-primary flex items-center gap-2 disabled:opacity-60"
              >
                <Save size={16} />
                {entrySaving ? 'Saving...' : 'Save Results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}