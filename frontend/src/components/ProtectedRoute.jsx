import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * ProtectedRoute
 *
 * - checks authentication
 * - checks role if `roles` is passed
 * - checks page permission if `path` is passed (super_admin bypasses)
 * - checks `requireAdmin` for admin-only dashboard pages
 */
export default function ProtectedRoute({ roles, path, requireAdmin, children }) {
  const { user, loading, canAccess } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !['admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/login" replace />
  }

  if (path) {
    if (!canAccess(path)) return <Navigate to="/login" replace />
  }

  return children
}