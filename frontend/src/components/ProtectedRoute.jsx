import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * ProtectedRoute
 *
 * - checks authentication
 * - a user passes if their role is in `roles` OR the page is explicitly
 *   granted to them in `permissions` (so cross-department grants work)
 * - if `path` is passed, the page must always be granted (super_admin bypasses)
 * - checks `requireAdmin` for admin-only dashboard pages
 */
export default function ProtectedRoute({ roles, path, requireAdmin, children }) {
  const { user, loading, canAccess } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const roleOk = !roles || roles.includes(user.role)
  const granted = !!path && canAccess(path)

  if (!roleOk && !granted) {
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && !['admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/login" replace />
  }

  if (path && !granted) {
    return <Navigate to="/login" replace />
  }

  return children
}