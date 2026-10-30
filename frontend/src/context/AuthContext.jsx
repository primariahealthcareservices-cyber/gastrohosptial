import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)
const STORAGE_USER = 'hms_user'
const STORAGE_TOKEN = 'token'

export function normalizeUser(u) {
  if (!u) return null
  return {
    ...u,
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
    discount_percentage: Number(u.discount_percentage || 0),
  }
}

export function dashboardPathForRole(role) {
  switch (role) {
    case 'super_admin': return '/superadmin/dashboard'
    case 'admin':       return '/admin/dashboard'
    case 'lab_technician': return '/lab/dashboard'
    case 'pharmacy':    return '/pharmacy/dashboard'
    case 'executive':   return '/executive/dashboard'
    default:            return '/login'
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return normalizeUser(JSON.parse(localStorage.getItem(STORAGE_USER)))
    } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem(STORAGE_TOKEN)
      if (!token) { setLoading(false); return }
      try {
        const { data } = await api.get('/auth/me')
        const u = normalizeUser(data)
        localStorage.setItem(STORAGE_USER, JSON.stringify(u))
        setUser(u)
      } catch {
        localStorage.removeItem(STORAGE_TOKEN)
        localStorage.removeItem(STORAGE_USER)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    bootstrap()
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem(STORAGE_TOKEN, data.access_token)
    const u = normalizeUser(data.user)
    localStorage.setItem(STORAGE_USER, JSON.stringify(u))
    setUser(u)
    return u
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN)
    localStorage.removeItem(STORAGE_USER)
    setUser(null)
  }

  /**
   * canAccess(path) → boolean
   *  - super_admin: always true
   *  - admin & others: only pages granted in `permissions`
   *  - if `permissions` is empty → block (forces super_admin to grant access explicitly)
   */
  const canAccess = (path) => {
    if (!user) return false
    if (user.role === 'super_admin') return true
    if (Array.isArray(user.permissions) && user.permissions.length > 0) {
      return user.permissions.includes(path)
    }
    return false
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, canAccess }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)