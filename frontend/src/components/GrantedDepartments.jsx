import { NavLink } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DEPARTMENTS = [
  { label: 'Executive', prefix: '/executive', landing: '/executive/dashboard' },
  { label: 'Pharmacy',  prefix: '/pharmacy',  landing: '/pharmacy/dashboard' },
  { label: 'Lab',       prefix: '/lab',       landing: '/lab/dashboard' },
  { label: 'Doctor',    prefix: '/doctor',    landing: '/doctor/dashboard' },
]

export default function GrantedDepartments({ exclude = [], className = '' }) {
  const { user, canAccess } = useAuth()
  if (!user || user.role === 'super_admin') return null

  // Only show a department if the user can actually reach its dashboard.
  // A report-only grant (e.g. /executive/reports/ip-lab) must NOT show
  // an "Executive" entry pointing at a report page.
  const items = DEPARTMENTS
    .filter((d) => !exclude.includes(d.prefix))
    .filter((d) => canAccess(d.landing))
    .map((d) => ({ ...d, to: d.landing }))

  if (items.length === 0) return null

  return (
    <div className={className}>
      <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink/40">
        Other access
      </p>
      {items.map((d) => (
        <NavLink
          key={d.prefix}
          to={d.to}
          className="flex items-center gap-3 px-4 py-2.5 text-sm text-ink/60 hover:bg-ink/5"
        >
          <ExternalLink size={16} className="shrink-0" />
          {d.label}
        </NavLink>
      ))}
    </div>
  )
}