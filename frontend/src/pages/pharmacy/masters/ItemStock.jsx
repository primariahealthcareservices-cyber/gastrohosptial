import { useState, useEffect, useRef } from 'react'
import { PageHeader } from '../../../components/PageHeader'
import { itemTypeApi, itemStockApi } from '../../../api/axios'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function ItemStock() {
  const [itemTypes, setItemTypes] = useState([])
  const [selectedType, setSelectedType] = useState('--All--')
  const [search, setSearch] = useState('')
  
  const [data, setData] = useState([])
  const [summary, setSummary] = useState(null)
  const [expirySummary, setExpirySummary] = useState(null)
  
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const printRef = useRef()

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const res = await itemTypeApi.getAll({ limit: 1000 }) 
        const list = Array.isArray(res) ? res : (res?.data ?? [])
        setItemTypes(list)
      } catch (error) {
        console.error("Failed to load item types", error)
      }
    }
    fetchTypes()
  }, [])

  const fetchStock = async () => {
    setLoading(true)
    try {
      const res = await itemStockApi.getStock({ 
        item_type: selectedType === '--All--' ? '' : selectedType,
        search: search,
        page: page,
        limit: limit
      })
      setData(res.data || [])
      setTotal(res.total || 0)
      setTotalPages(Math.ceil((res.total || 0) / limit) || 1)
      setSummary(res.summary || null)
      setExpirySummary(res.expiry_summary || null)
    } catch (error) {
      console.error("Failed to fetch stock", error)
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(fetchStock, 300)
    return () => clearTimeout(timer)
  }, [selectedType, search, page, limit])

  useEffect(() => {
    setPage(1)
  }, [selectedType, search, limit])

  const fmt = (num) => {
    if (!num && num !== 0) return '0.00';
    return Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- EXPORT TO EXCEL LOGIC ---
  const handleExportExcel = () => {
    if (data.length === 0) {
      alert("No data to export!");
      return;
    }

    // 1. Build the HTML table structure for Excel
    let tableHTML = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          th { background-color: #5ba2d6; color: white; font-weight: bold; border: 1px solid #000; }
          td { border: 1px solid #ccc; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <h2>Item Opening Stock - ${selectedType}</h2>
        <table border="1">
          <thead>
            <tr>
              <th>HSN Code</th>
              <th>Item Name</th>
              <th>Batch No</th>
              <th>Composition</th>
              <th>Drug Combination</th>
              <th>Purchase Date</th>
              <th>Exp Date</th>
              <th class="text-right">Original Qty</th>
              <th class="text-right">Current Qty</th>
              <th class="text-right">MRP</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Eff.Rate</th>
            </tr>
          </thead>
          <tbody>
    `;

    // 2. Loop through data and add rows
    data.forEach((row) => {
      tableHTML += `
        <tr>
          <td>${row.hsn_code || ''}</td>
          <td>${row.item_name || ''}</td>
          <td>${row.batch_no || ''}</td>
          <td>${row.composition || ''}</td>
          <td>${row.drug_combination || ''}</td>
          <td>${row.purchase_date || ''}</td>
          <td>${row.exp_date || ''}</td>
          <td class="text-right">${row.original_qty}</td>
          <td class="text-right">${row.current_qty}</td>
          <td class="text-right">${row.mrp}</td>
          <td class="text-right">${row.rate}</td>
          <td class="text-right">${row.eff_rate}</td>
        </tr>
      `;
    });

    tableHTML += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    // 3. Create a Blob and trigger download
    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Item_Stock_${selectedType}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML
    const printWindow = window.open('', '', 'height=800,width=1200')
    printWindow.document.write('<html><head><title>Item Stock Report</title>')
    printWindow.document.write(`
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 11px; }
        h2 { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #000; padding: 5px; text-align: left; }
        th { background-color: #f0f0f0; }
        .text-right { text-align: right; }
      </style>
    `)
    printWindow.document.write('</head><body>')
    printWindow.document.write(`<h2>Item Opening Stock - ${selectedType}</h2>`)
    printWindow.document.write(printContent)
    printWindow.document.write('</body></html>')
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250)
  }

  const startRow = total === 0 ? 0 : (page - 1) * limit + 1
  const endRow = Math.min(page * limit, total)

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      <PageHeader title="Item Stock" subtitle="Manage item stock" />

      <div className="bg-white border border-gray-300 rounded-sm mt-4 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg">Item Opening Stock</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm">Search:</span>
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border border-gray-300 p-1.5 rounded-sm text-sm outline-none focus:border-blue-500 w-64"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-4">
            <select 
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="border border-gray-300 p-2 rounded-sm text-sm outline-none focus:border-blue-500 w-48 bg-white"
            >
              <option value="--All--">--All--</option>
              {itemTypes.map((type) => (
                <option key={type.id} value={type.name}>{type.name}</option>
              ))}
            </select>

            <div className="flex">
              {/* THIS BUTTON NOW CALLS THE EXPORT FUNCTION */}
              <button 
                onClick={handleExportExcel}
                className="bg-[#5ba2d6] text-white px-6 py-2 text-sm border-r border-white hover:bg-blue-600"
              >
                Export to Excel
              </button>
              <button className="bg-[#8bc34a] text-white px-6 py-2 text-sm border-r border-white hover:bg-green-600">Export Stock</button>
              <button onClick={handlePrint} className="bg-[#5ba2d6] text-white px-8 py-2 text-sm hover:bg-blue-600">Print</button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>Show</span>
            <select 
              value={limit} 
              onChange={(e) => setLimit(Number(e.target.value))}
              className="border border-gray-300 p-1 rounded-sm outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>entries</span>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-300">
          <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
            <thead className="bg-[#5ba2d6] text-white">
              <tr>
                <th className="p-2 border border-gray-400 w-8"></th>
                <th className="p-2 border border-gray-400">HSN Code</th>
                <th className="p-2 border border-gray-400">Item Name</th>
                <th className="p-2 border border-gray-400">Batch No</th>
                <th className="p-2 border border-gray-400">Composition</th>
                <th className="p-2 border border-gray-400">Drug Combination</th>
                <th className="p-2 border border-gray-400">Purchase Date</th>
                <th className="p-2 border border-gray-400">Exp Date</th>
                <th className="p-2 border border-gray-400 text-right">Original StockQty</th>
                <th className="p-2 border border-gray-400 text-right">Current StockQty</th>
                <th className="p-2 border border-gray-400 text-right">Mrp</th>
                <th className="p-2 border border-gray-400 text-right">Rate</th>
                <th className="p-2 border border-gray-400 text-right">Eff.Rate</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="13" className="text-center p-4">Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="13" className="text-center p-4 text-gray-500">No records found for this filter.</td></tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50 bg-gray-50">
                    <td className="p-0 border border-gray-300 text-center">
                      <div className={`w-4 h-4 mx-auto ${row.status === 'red' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    </td>
                    <td className="p-2 border border-gray-300">{row.hsn_code || '-'}</td>
                    <td className="p-2 border border-gray-300 font-medium">{row.item_name || '-'}</td>
                    <td className="p-2 border border-gray-300">{row.batch_no}</td>
                    <td className="p-2 border border-gray-300">{row.composition || '-'}</td>
                    <td className="p-2 border border-gray-300">{row.drug_combination || '-'}</td>
                    <td className="p-2 border border-gray-300">{row.purchase_date}</td>
                    <td className="p-2 border border-gray-300">{row.exp_date}</td>
                    <td className="p-2 border border-gray-300 text-right">{row.original_qty}</td>
                    <td className="p-2 border border-gray-300 text-right">{row.current_qty}</td>
                    <td className="p-2 border border-gray-300 text-right">{fmt(row.mrp)}</td>
                    <td className="p-2 border border-gray-300 text-right">{fmt(row.rate)}</td>
                    <td className="p-2 border border-gray-300 text-right">{fmt(row.eff_rate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 text-sm text-gray-600">
          <div>
            Showing <span className="font-bold">{startRow}</span> to <span className="font-bold">{endRow}</span> of <span className="font-bold">{total}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 border border-gray-300 rounded-sm bg-white disabled:opacity-50 hover:bg-gray-100"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 py-1 bg-gray-200 border border-gray-300 rounded-sm font-medium">
              {page} / {totalPages}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || totalPages === 0}
              className="px-2 py-1 border border-gray-300 rounded-sm bg-white disabled:opacity-50 hover:bg-gray-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {summary && (
          <div className="mt-8 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 border-b border-gray-300 pb-4 text-sm font-semibold text-gray-800">
              <div>OriginalStock : <br/><span className="text-gray-600">{fmt(summary.original_stock)}</span></div>
              <div>CurrentStock : <br/><span className="text-gray-600">{fmt(summary.current_stock)}</span></div>
              <div>OriginalStockAmount (₹) : <br/><span className="text-gray-600">{fmt(summary.original_amount)}</span></div>
              <div>CurrentStockAmount (₹) : <br/><span className="text-gray-600">{fmt(summary.current_amount)}</span></div>
              <div>OriginalStockRate (₹) : <br/><span className="text-gray-600">{fmt(summary.original_rate)}</span></div>
              <div>CurrentStockRate (₹) : <br/><span className="text-gray-600">{fmt(summary.current_rate)}</span></div>
            </div>

            {expirySummary && (
              <div>
                <h4 className="font-bold text-base mb-3 text-gray-800">Expiry Stock Info</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 border-b border-gray-300 pb-4 text-sm font-semibold text-gray-800">
                  <div>OriginalStock : <br/><span className="text-gray-600">{fmt(expirySummary.original_stock)}</span></div>
                  <div>CurrentStock : <br/><span className="text-gray-600">{fmt(expirySummary.current_stock)}</span></div>
                  <div>OriginalStockAmount (₹) : <br/><span className="text-gray-600">{fmt(expirySummary.original_amount)}</span></div>
                  <div>CurrentStockAmount (₹) : <br/><span className="text-gray-600">{fmt(expirySummary.current_amount)}</span></div>
                  <div>OriginalStockRate (₹) : <br/><span className="text-gray-600">{fmt(expirySummary.original_rate)}</span></div>
                  <div>CurrentStockRate (₹) : <br/><span className="text-gray-600">{fmt(expirySummary.current_rate)}</span></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'none' }}>
        <div ref={printRef}>
          <table>
            <thead>
              <tr>
                <th>HSN Code</th>
                <th>Item Name</th>
                <th>Batch No</th>
                <th>Purchase Date</th>
                <th>Exp Date</th>
                <th>Orig Qty</th>
                <th>Curr Qty</th>
                <th>MRP</th>
                <th>Rate</th>
                <th>Eff.Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.hsn_code}</td>
                  <td>{row.item_name}</td>
                  <td>{row.batch_no}</td>
                  <td>{row.purchase_date}</td>
                  <td>{row.exp_date}</td>
                  <td className="text-right">{row.original_qty}</td>
                  <td className="text-right">{row.current_qty}</td>
                  <td className="text-right">{fmt(row.mrp)}</td>
                  <td className="text-right">{fmt(row.rate)}</td>
                  <td className="text-right">{fmt(row.eff_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}