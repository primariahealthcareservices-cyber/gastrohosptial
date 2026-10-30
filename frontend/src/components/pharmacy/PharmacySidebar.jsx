import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Boxes, ArrowLeftRight, ShoppingCart, RotateCcw,
  FileBarChart, Wallet, Package, Receipt, LogOut, ChevronDown, ChevronRight, Copy,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const NAV_TREE = [
  {
    type: 'group', key: 'masters', label: 'Masters', icon: Boxes,
    children: [
      { label: 'Inventory Type', to: '/pharmacy/masters/inventory-type' },
      { label: 'Item Type', to: '/pharmacy/masters/item-type' },
      { label: 'Supplier', to: '/pharmacy/masters/supplier' },
      { label: 'Manufacture', to: '/pharmacy/masters/manufacturer' },
      { label: 'Tax Categories', to: '/pharmacy/masters/tax-categories' },
      { label: 'Rack Master', to: '/pharmacy/masters/rack-master' },
      { label: 'Item Master', to: '/pharmacy/masters/item-master' },
      { label: 'Item Package Master', to: '/pharmacy/masters/item-package-master' },
      { label: 'Drug Combination', to: '/pharmacy/masters/drug-combination' },
    ],
  },
  {
    type: 'group', key: 'transaction', label: 'Transaction', icon: ArrowLeftRight,
    children: [
      { label: 'Purchase Order', to: '/pharmacy/transaction/purchase-order' },
      { label: 'Goods Receive Note', to: '/pharmacy/transaction/goods-receive-note' },
      { label: 'Stock Adjustments', to: '/pharmacy/transaction/stock-adjustments' },
      { label: 'Stock Returns', to: '/pharmacy/transaction/stock-returns' },
    ],
  },
  {
    type: 'group', key: 'sales', label: 'Sales', icon: ShoppingCart,
    children: [
      { label: 'Inpatient', to: '/pharmacy/sales/inpatient' },
      { label: 'Outpatient', to: '/pharmacy/sales/outpatient' },
      { label: 'Patient Indents', to: '/pharmacy/sales/patient-indents' },
      { label: 'OT / Indents', to: '/pharmacy/sales/ot-indents' },
    ],
  },
  {
    type: 'group', key: 'sales-returns', label: 'Sales Returns', icon: RotateCcw,
    children: [
      { label: 'Inpatient', to: '/pharmacy/sales-returns/inpatient' },
      { label: 'Outpatient', to: '/pharmacy/sales-returns/outpatient' },
    ],
  },
  { type: 'link', label: 'Duplicate Invoice', to: '/pharmacy/duplicate-invoice', icon: Copy },
  {
    type: 'group', key: 'reports', label: 'Reports', icon: FileBarChart,
    children: [
      { label: 'Total Sales', to: '/pharmacy/reports/total-sales' },
      { label: 'Due Received Report', to: '/pharmacy/reports/due-received' },
      { label: 'Sales Returns', to: '/pharmacy/reports/sales-returns' },
      { label: 'OP/IP Sales Reports', to: '/pharmacy/reports/op-ip-sales' },
      { label: 'OP/IP Due Report', to: '/pharmacy/reports/op-ip-due' },
      { label: 'Pharmacy Due Report', to: '/pharmacy/reports/pharmacy-due' },
      { label: 'Schedule/Item Report', to: '/pharmacy/reports/schedule-item' },
      { label: 'Purchasewise Item Report', to: '/pharmacy/reports/purchasewise-item' },
      { label: 'Employee Sales Report', to: '/pharmacy/reports/employee-sales' },
      { label: 'Sales Report', to: '/pharmacy/reports/sales' },
      { label: 'New Sales Report', to: '/pharmacy/reports/new-sales' },
      { label: 'Product Wise Sales Report', to: '/pharmacy/reports/product-wise-sales' },
      { label: 'GRN Report', to: '/pharmacy/reports/grn' },
      { label: 'GRN Adjustment Report', to: '/pharmacy/reports/grn-adjustment' },
      { label: 'Profit Report', to: '/pharmacy/reports/profit' },
      { label: 'Purchase Payments', to: '/pharmacy/reports/purchase-payments' },
      { label: 'Stock Returns Report', to: '/pharmacy/reports/stock-returns' },
      { label: 'Supplier Wise Purchase Report', to: '/pharmacy/reports/supplier-wise-purchase' },
      { label: 'GRN Wise Purchase Report', to: '/pharmacy/reports/grn-wise-purchase' },
      { label: 'OT Indents Report', to: '/pharmacy/reports/ot-indents' },
      { label: 'Doctor Sales Report', to: '/pharmacy/reports/doctor-sales' },
      { label: 'Doctor Wise Item Sales Report', to: '/pharmacy/reports/doctor-wise-item-sales' },
      { label: 'Patient Wise Sale', to: '/pharmacy/reports/patient-wise-sale' },
      { label: 'Item Wise Sale Report', to: '/pharmacy/reports/item-wise-sale' },
      { label: 'Invoice Tax Report', to: '/pharmacy/reports/invoice-tax' },
      { label: 'Stock Adjustment Report', to: '/pharmacy/reports/stock-adjustment' },
      { label: 'Non Moving Stock Report', to: '/pharmacy/reports/non-moving-stock' },
      { label: 'Minimum Stock Report', to: '/pharmacy/reports/minimum-stock' },
      { label: 'Supplier Wise Item Purchase', to: '/pharmacy/reports/supplier-wise-item-purchase' },
      { label: 'Invoice Status Report', to: '/pharmacy/reports/invoice-status' },
      { label: 'Pharmacy Item Sale Tax Report', to: '/pharmacy/reports/item-sale-tax' },
      { label: 'User Wise Discount', to: '/pharmacy/reports/user-wise-discount' },
      { label: 'GRN Wise Sales Report', to: '/pharmacy/reports/grn-wise-sales' },
      { label: 'Stock Ledger', to: '/pharmacy/reports/stock-ledger' },
    ],
  },
  { type: 'link', label: 'Due Collections', to: '/pharmacy/due-collections', icon: Wallet },
  { type: 'link', label: 'Stock', to: '/pharmacy/stock', icon: Package },
  { type: 'link', label: 'Expenses', to: '/pharmacy/expenses', icon: Receipt },
]

function flattenLinks(node) {
  if (node.type === 'link') return [node.to]
  if (node.children) return node.children.flatMap(flattenLinks)
  return node.to ? [node.to] : []
}

export default function PharmacySidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [openGroups, setOpenGroups] = useState({})

  if (!user) return null

  const toggleGroup = (key) => setOpenGroups((g) => ({ ...g, [key]: !g[key] }))

  const linkClass = (isActive) =>
    `flex items-center gap-3 px-4 py-2.5 text-sm ${
      isActive ? 'bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600 font-medium' : 'text-ink/60 hover:bg-ink/5'
    }`

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const renderNode = (node) => {
    if (node.type === 'link') {
      const Icon = node.icon
      return (
        <NavLink key={node.to} to={node.to} className={({ isActive }) => linkClass(isActive)}>
          {Icon && <Icon size={16} className="shrink-0" />}
          {node.label}
        </NavLink>
      )
    }

    const allLinks = flattenLinks(node)
    const isOpen = openGroups[node.key] ?? allLinks.some((to) => location.pathname === to)
    const GroupIcon = node.icon

    return (
      <div key={node.key}>
        <button
          type="button"
          onClick={() => toggleGroup(node.key)}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-ink/70 hover:bg-ink/5"
        >
          <span className="flex items-center gap-3">
            {GroupIcon && <GroupIcon size={16} className="shrink-0" />}
            {node.label}
          </span>
          {isOpen ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
        </button>
        {isOpen && (
          <div className="bg-ink/[0.03]">
            {node.children.map((child) => (
              <NavLink
                key={child.to}
                to={child.to}
                className={({ isActive }) =>
                  `block pl-11 pr-4 py-2 text-sm ${
                    isActive ? 'text-indigo-700 font-medium' : 'text-ink/55 hover:text-ink/80'
                  }`
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-border bg-white">
      <div className="px-4 py-4 border-b border-border">
        <p className="font-semibold text-sm">HMS Pharmacy</p>
        <p className="text-xs text-ink/40 mt-0.5 capitalize">{user.role.replace('_', ' ')}</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <NavLink to="/pharmacy/dashboard" className={({ isActive }) => linkClass(isActive)}>
          <LayoutDashboard size={16} className="shrink-0" />
          Dashboard
        </NavLink>

        {NAV_TREE.map((node) => renderNode(node))}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-xs text-ink/50 truncate mb-2">{user.email}</p>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-danger-500 hover:underline">
          <LogOut size={14} className="shrink-0" /> Log out
        </button>
      </div>
    </aside>
  )
}