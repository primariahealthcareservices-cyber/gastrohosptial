import Sidebar from './Sidebar'
import DoctorSidebar from './doctor/DoctorSidebar'
import { useAuth } from '../context/AuthContext'

export default function Layout({ children }) {
  const { user } = useAuth()
  return (
    <div className="flex min-h-screen bg-ink/[0.02]">
      {user?.role === 'doctor' ? <DoctorSidebar /> : <Sidebar />}
      <main className="flex-1 p-6 overflow-x-hidden">{children}</main>
    </div>
  )
}