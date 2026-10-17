import { useState, useEffect } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { inventoryTypeApi } from '../../../api/axios';
import { Plus, Edit2, Trash2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function InventoryType() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await inventoryTypeApi.getAll({ search, page, limit });
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      setRows(list);
      setTotal(Number(res?.total) || 0);
      setTotalPages(Number(res?.total_pages) || 1);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to load inventory types';
      setError(msg);
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchRows, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, limit]);

  useEffect(() => {
    setPage(1);
  }, [search, limit]);

  useEffect(() => {
    if (isModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isModalOpen]);

  const handleOpenModal = (row = null) => {
    if (row) {
      setEditingId(row.id);
      setFormName(row.name);
      setFormIsActive(Boolean(row.is_active));
    } else {
      setEditingId(null);
      setFormName('');
      setFormIsActive(true);
    }
    setFormError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setFormName('');
    setFormIsActive(true);
    setEditingId(null);
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) return setFormError('Inventory Type name is required');

    setSubmitting(true);
    try {
      if (editingId) {
        await inventoryTypeApi.update(editingId, formName.trim(), formIsActive);
      } else {
        await inventoryTypeApi.create(formName.trim(), formIsActive);
      }
      handleCloseModal();
      fetchRows();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this inventory type?')) return;
    try {
      await inventoryTypeApi.delete(id);
      if ((rows ?? []).length === 1 && page > 1) setPage((p) => p - 1);
      else fetchRows();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const tp = Number(totalPages) || 1;
    const cp = Number(page) || 1;
    const maxVisible = 5;
    if (tp <= maxVisible + 2) {
      for (let i = 1; i <= tp; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, cp - 1);
      let end = Math.min(tp - 1, cp + 1);
      if (cp <= 3) { start = 2; end = 4; }
      if (cp >= tp - 2) { start = tp - 3; end = tp - 1; }
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < tp - 1) pages.push('...');
      pages.push(tp);
    }
    return pages;
  };

  const safeTotal = Number(total) || 0;
  const safeLimit = Number(limit) || 10;
  const safePage = Number(page) || 1;
  const startRow = safeTotal === 0 ? 0 : (safePage - 1) * safeLimit + 1;
  const endRow = Math.min(safePage * safeLimit, safeTotal);

  return (
    <div>
      <PageHeader title="Inventory Type" subtitle="Manage inventory categories" />

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 mt-2">
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-[#5B9BD5] hover:bg-[#4a8ac0] text-white text-sm font-medium rounded-sm transition-colors"
        >
          <Plus size={16} />
          Add Inventory
        </button>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-gray-300 rounded-sm px-2 py-1 focus:outline-none focus:border-[#5B9BD5]"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Search:</span>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5] w-48 sm:w-64"
                placeholder="Name"
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
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium w-32">IsActive</th>
              <th className="px-4 py-3 font-medium w-24 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan="3" className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : (rows ?? []).length === 0 ? (
              <tr><td colSpan="3" className="px-4 py-8 text-center text-gray-500">No inventory types found.</td></tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-800">{row.name}</td>
                  <td className="px-4 py-2.5">
                    {row.is_active ? (
                      <span className="text-green-600 font-medium">True</span>
                    ) : (
                      <span className="text-gray-400 font-medium">False</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => handleOpenModal(row)} className="text-blue-500 hover:text-blue-700" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(row.id)} className="text-red-500 hover:text-red-700" title="Delete">
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
              <ChevronLeft size={14} />
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
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
        >
          <div
            className="bg-white rounded-sm shadow-xl w-full max-w-md overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingId ? 'Edit Inventory Type' : 'Add Inventory Type'}
              </h3>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off" noValidate>
              <div className="p-6 space-y-4">
                {formError && (
                  <div className="text-sm text-red-500 bg-red-50 p-2 rounded-sm border border-red-200">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="inventory_type_name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:outline-none focus:border-[#5B9BD5]"
                    placeholder="e.g., NEB, SURGICAL, AMP"
                    autoComplete="off"
                    autoFocus
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active_cb"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_active_cb" className="text-sm text-gray-700">
                    Is Active
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#5B9BD5] rounded-sm hover:bg-[#4a8ac0] disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : (editingId ? 'Update' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}