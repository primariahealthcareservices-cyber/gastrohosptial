import { useEffect, useState } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { itemStockApi, supplierApi, manufacturerApi } from '../../api/axios';

export default function ItemStock() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await itemStockApi.getAll({ search, page, limit });
      const list = Array.isArray(res) ? res : (res?.data ?? []);
      setRows(list);
      setTotal(Number(res?.total) || 0);
      setTotalPages(Number(res?.total_pages) || 1);
    } catch (err) {
      console.error('Failed to load stock', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchRows, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  useEffect(() => { setPage(1) }, [search]);

  const safeTotal = Number(total) || 0;
  const startRow = safeTotal === 0 ? 0 : (page - 1) * limit + 1;
  const endRow = Math.min(page * limit, safeTotal);

  const calcEffInc = (r) => Number(r.rate || 0) * (1 + Number(r.new_tax_percent || 0) / 100);
  const calcEffExc = (r) => Number(r.rate || 0);
  const calcMargin = (r) => Number(r.new_mrp || 0) - calcEffExc(r);
  const calcMarginPct = (r) => Number(r.new_mrp) > 0 ? (calcMargin(r) / Number(r.new_mrp)) * 100 : 0;

  return (
    <div>
      <PageHeader title="Item Opening Stock" subtitle="Manage pharmacy stock" />

      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden flex flex-col h-[80vh]">
        
        {/* Top Toolbar */}
        <div className="p-4 flex flex-wrap justify-between items-center gap-4 border-b border-gray-200">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-[#5B9BD5] hover:bg-[#4a8ac0] text-white rounded-sm font-medium">
              <Plus size={16} /> Add New Stock Item
            </button>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span>Search:</span>
              <div className="relative">
                <input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-sm w-64 focus:outline-none focus:border-[#5B9BD5]" placeholder="Item name..." />
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#5B9BD5] text-white sticky top-0 z-10">
              <tr>
                <th className="px-2 py-3 font-medium">HSN Code</th>
                <th className="px-2 py-3 font-medium">Item Name</th>
                <th className="px-2 py-3 font-medium">Batch No</th>
                <th className="px-2 py-3 font-medium">Composition</th>
                <th className="px-2 py-3 font-medium">Drug Combo</th>
                <th className="px-2 py-3 font-medium">Purchase Date</th>
                <th className="px-2 py-3 font-medium">Exp Date</th>
                <th className="px-2 py-3 font-medium text-right">Orig. Stock</th>
                <th className="px-2 py-3 font-medium text-right">Curr. Stock</th>
                <th className="px-2 py-3 font-medium text-right">MRP</th>
                <th className="px-2 py-3 font-medium text-right">Rate</th>
                <th className="px-2 py-3 font-medium text-right">Eff. Rate (Inc)</th>
                <th className="px-2 py-3 font-medium text-right">Total MRP Val</th>
                <th className="px-2 py-3 font-medium text-right">Margin</th>
                <th className="px-2 py-3 font-medium text-right">Margin %</th>
                <th className="px-2 py-3 font-medium">Supplier</th>
                <th className="px-2 py-3 font-medium">Manufacturer</th>
                <th className="px-2 py-3 font-medium">Doctor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr><td colSpan="18" className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="18" className="px-4 py-8 text-center text-gray-500">No items found.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2">{r.hsn_code || ''}</td>
                    <td className="px-2 py-2 font-medium text-gray-800">{r.item_name}</td>
                    <td className="px-2 py-2">{r.batch_no || ''}</td>
                    <td className="px-2 py-2">{r.composition || ''}</td>
                    <td className="px-2 py-2">{r.drug_combination || ''}</td>
                    <td className="px-2 py-2">{r.purchase_date || ''}</td>
                    <td className="px-2 py-2">{r.exp_date || ''}</td>
                    <td className="px-2 py-2 text-right">{r.original_stock || 0}</td>
                    <td className="px-2 py-2 text-right font-medium">{r.available_stock || 0}</td>
                    <td className="px-2 py-2 text-right">{Number(r.new_mrp || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{Number(r.rate || 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{calcEffInc(r).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{(Number(r.available_stock) * Number(r.new_mrp)).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{calcMargin(r).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{calcMarginPct(r).toFixed(2)}%</td>
                    <td className="px-2 py-2 truncate max-w-[150px]" title={r.supplier_name}>{r.supplier_name || '—'}</td>
                    <td className="px-2 py-2">{r.manufacturer || '—'}</td>
                    <td className="px-2 py-2">{r.doctor_name || 'General'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-sm">
          <div className="text-gray-600">
            Showing <b>{startRow}</b> to <b>{endRow}</b> of <b>{safeTotal}</b> entries
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-gray-300 rounded-sm disabled:opacity-50">« Prev</button>
            <span className="px-3 py-1 bg-white border border-gray-300 rounded-sm">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border border-gray-300 rounded-sm disabled:opacity-50">Next »</button>
          </div>
        </div>
      </div>

      {showModal && (
        <AddStockModal 
          onClose={() => setShowModal(false)} 
          onSave={() => { setShowModal(false); fetchRows(); }} 
        />
      )}
    </div>
  );
}

// ============================================================
// Add Stock Modal
// ============================================================
function AddStockModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    item_name: '', hsn_code: '', batch_no: '', composition: '', drug_combination: '',
    item_type: '', pack: '', rack: '', purchase_date: '', exp_date: '',
    original_stock: '', available_stock: '', avg_monthly_usage: '',
    new_mrp: '', old_mrp: '', rate: '', new_tax_percent: '', old_tax_percent: '',
    manufacturer: '', doctor_name: '', supplier_id: ''
  });
  
  const [suppliers, setSuppliers] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supplierApi.getAll({ limit: 500 }).then(res => setSuppliers(Array.isArray(res) ? res : (res?.data ?? []))).catch(() => {});
    manufacturerApi.getAll({ limit: 500 }).then(res => setManufacturers(Array.isArray(res) ? res : (res?.data ?? []))).catch(() => {});
  }, []);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.item_name.trim()) return setError('Item Name is required');
    setLoading(true);
    setError('');
    try {
      await itemStockApi.create(form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-sm shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Add New Stock Entry</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6" autoComplete="off">
          {error && <div className="mb-4 text-red-500 bg-red-50 p-2 rounded-sm">{error}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input className="w-full px-3 py-2 border rounded-sm" value={form.item_name} onChange={e => update('item_name', e.target.value)} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
              <input className="w-full px-3 py-2 border rounded-sm" value={form.hsn_code} onChange={e => update('hsn_code', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch No</label>
              <input className="w-full px-3 py-2 border rounded-sm" value={form.batch_no} onChange={e => update('batch_no', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select className="w-full px-3 py-2 border rounded-sm" value={form.supplier_id} onChange={e => update('supplier_id', e.target.value)}>
                <option value="">Select</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
              <select className="w-full px-3 py-2 border rounded-sm" value={form.manufacturer} onChange={e => update('manufacturer', e.target.value)}>
                <option value="">Select</option>
                {manufacturers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Composition</label>
              <input className="w-full px-3 py-2 border rounded-sm" value={form.composition} onChange={e => update('composition', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Drug Combination</label>
              <input className="w-full px-3 py-2 border rounded-sm" value={form.drug_combination} onChange={e => update('drug_combination', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
              <input type="date" className="w-full px-3 py-2 border rounded-sm" value={form.purchase_date} onChange={e => update('purchase_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
              <input type="date" className="w-full px-3 py-2 border rounded-sm" value={form.exp_date} onChange={e => update('exp_date', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Original Stock</label>
              <input type="number" className="w-full px-3 py-2 border rounded-sm" value={form.original_stock} onChange={e => update('original_stock', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available Stock</label>
              <input type="number" className="w-full px-3 py-2 border rounded-sm" value={form.available_stock} onChange={e => update('available_stock', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New MRP</label>
              <input type="number" step="0.01" className="w-full px-3 py-2 border rounded-sm" value={form.new_mrp} onChange={e => update('new_mrp', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Old MRP</label>
              <input type="number" step="0.01" className="w-full px-3 py-2 border rounded-sm" value={form.old_mrp} onChange={e => update('old_mrp', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rate</label>
              <input type="number" step="0.01" className="w-full px-3 py-2 border rounded-sm" value={form.rate} onChange={e => update('rate', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Tax (%)</label>
              <input type="number" step="0.01" className="w-full px-3 py-2 border rounded-sm" value={form.new_tax_percent} onChange={e => update('new_tax_percent', e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Old Tax (%)</label>
              <input type="number" step="0.01" className="w-full px-3 py-2 border rounded-sm" value={form.old_tax_percent} onChange={e => update('old_tax_percent', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
              <input className="w-full px-3 py-2 border rounded-sm" value={form.item_type} onChange={e => update('item_type', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pack</label>
              <input className="w-full px-3 py-2 border rounded-sm" value={form.pack} onChange={e => update('pack', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rack</label>
              <input className="w-full px-3 py-2 border rounded-sm" value={form.rack} onChange={e => update('rack', e.target.value)} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Avg Monthly Usage (6m)</label>
              <input type="number" className="w-full px-3 py-2 border rounded-sm" value={form.avg_monthly_usage} onChange={e => update('avg_monthly_usage', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name</label>
              <input className="w-full px-3 py-2 border rounded-sm" value={form.doctor_name} onChange={e => update('doctor_name', e.target.value)} placeholder="General" />
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-sm">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-[#5B9BD5] text-white rounded-sm">{loading ? 'Saving...' : 'Save Stock Entry'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}