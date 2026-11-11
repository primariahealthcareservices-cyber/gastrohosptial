import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { 
  LayoutDashboard, FileBarChart, LogOut, Menu, X, 
  UserPlus, CalendarCheck, BedDouble, Receipt, 
  Activity, FolderOpen, Stethoscope, ClipboardList,
  ChevronDown, ChevronRight, Settings
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// 1. Define the groups (Tree structure)
const DOCTOR_NAV_TREE = [
  {
    type: 'group',
    key: 'executive',
    label: 'Executive',
    icon: Receipt,
    children: [
      { to: '/executive/billing-modifications', label: 'Billing Modifications', icon: Receipt },
      { to: '/executive/patient-registration',  label: 'Patient Registration',  icon: UserPlus },
      { to: '/executive/appointments',          label: 'Appointments',          icon: CalendarCheck },
      { to: '/executive/admission',             label: 'Admission',             icon: BedDouble },
      { to: '/executive/op-billing',            label: 'OP Billing',            icon: Receipt },
      { to: '/executive/ip-billing',            label: 'IP Billing',            icon: Receipt },
      { to: '/executive/out-patients',          label: 'Out Patients',          icon: Activity },
      { to: '/executive/in-patients',           label: 'In Patients',           icon: BedDouble },
      { to: '/executive/patient-records',       label: 'Patient Records',       icon: FolderOpen },
      { to: '/executive/direct-services',       label: 'Direct Services',       icon: Stethoscope },
      { to: '/executive/room-occupation',       label: 'Room Occupation',       icon: BedDouble },
      { to: '/executive/ip-details',            label: 'IP Details',            icon: ClipboardList },
    ]
  },
  {
    type: 'group',
    key: 'reports',
    label: 'Reports',
    icon: FileBarChart,
    children: [
      { to: '/executive/reports/ip-lab',        label: 'IP Lab Reports',        icon: FileBarChart },
      { to: '/executive/reports/op-lab',        label: 'OP Lab Reports',        icon: FileBarChart },
      { to: '/executive/reports/ip-radiology',  label: 'IP Radiology Reports',  icon: FileBarChart },
      { to: '/executive/reports/op-radiology',  label: 'OP Radiology Reports',  icon: FileBarChart },
    ]
  },
  {
    type: 'group',
    key: 'lab',
    label: 'Lab',
    icon: Settings,
    children: [
      { to: '/lab/dashboard',                   label: 'Lab Dashboard',         icon: FileBarChart },
      { to: '/lab/op-reports',                  label: 'Lab OP Reports',        icon: FileBarChart },
      { to: '/lab/ip-reports',                  label: 'Lab IP Reports',        icon: FileBarChart },
      { to: '/lab/test-master',                 label: 'Test Master',           icon: Settings },
    ]
  }
]

export default function DoctorSidebar() {
  const { user, logout, canAccess } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  // State to track which folders are open
  const [openGroups, setOpenGroups] = useState({})

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const linkClass = (isActive, isSub = false) =>
    `flex items-center gap-3 py-2.5 text-sm transition-colors ${
      isSub ? 'pl-11 pr-4' : 'px-4'
    } ${
      isActive
        ? 'bg-teal-50 text-teal-700 border-r-2 border-teal-600 font-medium'
        : 'text-ink/60 hover:bg-ink/5'
    }`

  // Filter logic: only keep groups that have at least one accessible child
  const visibleTree = DOCTOR_NAV_TREE.map((group) => {
    const visibleChildren = group.children.filter((child) => canAccess(child.to))
    return { ...group, children: visibleChildren }
  }).filter((group) => group.children.length > 0)

  return (
    <>
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white border border-border rounded-sm"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`
          w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-border bg-white
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          fixed md:relative z-40
        `}
      >
        <div className="px-4 py-4 border-b border-border">
          <p className="font-semibold text-sm">HMS Doctor</p>
          <p className="text-xs text-ink/40 mt-0.5 capitalize">
            {user.role.replace('_', ' ')}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
          <NavLink
            to="/doctor/dashboard"
            className={({ isActive }) => linkClass(isActive)}
            onClick={() => setIsMobileOpen(false)}
          >
            <LayoutDashboard size={16} className="shrink-0" />
            Dashboard
          </NavLink>

          {visibleTree.map((group) => {
            // Default folders to open if they contain the current active URL
            const hasActiveChild = group.children.some(child => location.pathname.includes(child.to))
            const isOpen = openGroups[group.key] ?? hasActiveChild
            const GroupIcon = group.icon

            return (
              <div key={group.key} className="pt-2">
                {/* Folder Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink/40 hover:bg-ink/5"
                >
                  <span className="flex items-center gap-3">
                    <GroupIcon size={14} className="shrink-0" />
                    {group.label}
                  </span>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {/* Folder Children */}
                {isOpen && (
                  <div className="flex flex-col mt-1">
                    {group.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) => linkClass(isActive, true)}
                        onClick={() => setIsMobileOpen(false)}
                      >
                        <child.icon size={16} className="shrink-0 opacity-70" />
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="px-4 py-3 border-t border-border mt-auto">
          <p className="text-xs text-ink/50 truncate mb-2">{user.email}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-danger-500 hover:underline"
          >
            <LogOut size={14} className="shrink-0" /> Log out
          </button>
        </div>
      </aside>
    </>
  )
}