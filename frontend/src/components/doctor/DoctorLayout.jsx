import { Outlet } from 'react-router-dom'
import DoctorSidebar from './DoctorSidebar'

export default function DoctorLayout() {
  return (
    <div className="min-h-screen flex">
      <DoctorSidebar />
      <main className="flex-1 min-w-0 bg-surface">
        <div className="max-w-7xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}