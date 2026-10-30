import { useEffect, useMemo, useState } from 'react'
import { Search, Save, X } from 'lucide-react'
import api from '../../api/axios'
import { PageHeader } from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'

export default function DiscountPermissions() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(null)
  const [editing, setEditing] = useState(null)
  const [menuTree, setMenuTree] = useState([])

  useEffect(() => {
    (async () => {
      setLoading(true); setError('')
      try {
        const [u, m] = await Promise.all([
          api.get('/users'),
          api.get('/permissions/menu'),
        ])
        setUsers(u.data)
        setMenuTree(m.data)
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    )
  }, [users, search])

  // Only super_admin can edit anything
  const canEditRow = () => currentUser?.role === 'super_admin'

  const startEdit = (u) => {
    if (!canEditRow()) return
    setEditing({
      id: u.id,
      name: u.name,
      role: u.role,
      discount_percentage: u.discount_percentage ?? 0,
      permissions: Array.isArray(u.permissions) ? [...u.permissions] : [],
    })
  }

  const cancel = () => setEditing(null)

  const togglePerm = (path) => {
    setEditing(prev => ({
      ...prev,
      permissions: prev.permissions.includes(path)
        ? prev.permissions.filter(p => p !== path)
        : [...prev.permissions, path],
    }))
  }

  const toggleGroup = (children) => {
    const allChecked = children.every(c => editing.permissions.includes(c.path))
    const paths = children.map(c => c.path)
    setEditing(prev => ({
      ...prev,
      permissions: allChecked
        ? prev.permissions.filter(p => !paths.includes(p))
        : Array.from(new Set([...prev.permissions, ...paths])),
    }))
  }

  const save = async () => {
    if (!editing) return
    setSaving(editing.id); setError('')
    try {
      await api.patch(`/users/${editing.id}/discount-permissions`, {
        discount_percentage: Number(editing.discount_percentage),
        permissions: editing.permissions,
      })
      const { data } = await api.get('/users')
      setUsers(data)
      setEditing(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Discount & Permissions"
        subtitle={
          currentUser?.role === 'super_admin'
            ? 'Manage per-user discount % and page access. Super admin can edit everyone.'
            : 'View-only for admins. Only super admin can modify access.'
        }
      />

      {error && (
        <div className="text-sm text-danger-500 bg-danger-50 border border-danger-200 rounded-sm px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <Search size={16} />
        <input
          className="input max-w-sm"
          placeholder="Search by name, email, role"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <div className="text-center py-4">Loading...</div>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-8 text-ink/50">No users found.</div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th>
                <th>Discount %</th><th>Permissions</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    {editing?.id === u.id ? (
                      <input
                        type="number" min="0" max="100" step="0.01"
                        className="input w-24"
                        value={editing.discount_percentage}
                        onChange={(e) => setEditing({
                          ...editing,
                          discount_percentage: e.target.value,
                        })}
                      />
                    ) : (
                      `${Number(u.discount_percentage || 0).toFixed(2)}%`
                    )}
                  </td>
                  <td>
                    {u.role === 'super_admin'
                      ? <span className="text-xs text-green-600 font-medium">Full access</span>
                      : `${(u.permissions || []).length} pages`}
                  </td>
                  <td>
                    {editing?.id === u.id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={save}
                          disabled={saving === u.id}
                          className="text-green-600 hover:text-green-800"
                          title="Save"
                        >
                          <Save size={16} />
                        </button>
                        <button onClick={cancel} className="text-gray-500 hover:text-gray-700" title="Cancel">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(u)}
                        disabled={!canEditRow()}
                        className={`text-sm font-medium ${
                          canEditRow()
                            ? 'text-indigo-600 hover:text-indigo-800'
                            : 'text-ink/30 cursor-not-allowed'
                        }`}
                        title={canEditRow() ? '' : 'Only super admin can edit'}
                      >
                        {canEditRow() ? 'Edit' : 'Locked'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="mt-6 border border-border rounded-sm p-4 bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-sm">
              Page access for <span className="text-indigo-700">{editing.name}</span>{' '}
              <span className="text-ink/40 text-xs">({editing.role})</span>
            </h3>
            <div className="flex items-center gap-3 text-sm text-ink/60">
              <span>{editing.permissions.length} selected</span>
              <button onClick={cancel} className="text-ink/50 hover:text-ink">
                <X size={18} />
              </button>
            </div>
          </div>

          {editing.role === 'super_admin' && (
            <div className="text-xs text-ink/60 mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-sm">
              Super admins always have full access. The permissions below only apply if this user is later downgraded.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {menuTree.map(group => {
              const children = group.children || []
              const allChecked = children.length > 0 && children.every(c => editing.permissions.includes(c.path))
              return (
                <div key={group.label} className="border border-border rounded-sm p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold text-xs uppercase tracking-wide text-ink/50">
                      {group.label}
                    </div>
                    <button
                      onClick={() => toggleGroup(children)}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      {allChecked ? 'Uncheck all' : 'Check all'}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                    {children.map(p => (
                      <label key={p.path} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editing.permissions.includes(p.path)}
                          onChange={() => togglePerm(p.path)}
                        />
                        {p.label}
                        <span className="text-ink/30 text-[10px] ml-auto font-mono">{p.path}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}