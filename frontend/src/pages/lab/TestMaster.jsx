import { useEffect, useRef, useState } from 'react'
import { Search, Pencil, Trash2, X, Plus, GripVertical } from 'lucide-react'
import api from '../../api/axios'
import { PageHeader } from '../../components/PageHeader'

export default function TestMaster() {
  // ------------------------------------------------------------
  // Table state
  // ------------------------------------------------------------
  const [tests, setTests] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ------------------------------------------------------------
  // Form (big page)
  // ------------------------------------------------------------
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const [departments, setDepartments] = useState([])
  const [allTests, setAllTests] = useState([])

  const [form, setForm] = useState({
    department_id: '',
    test_id: '',
    test_name: '',
    short_name: '',
    cost: '',
    referral_cost: 0,
    method: '',
    note: '',
    image: '',
    is_active: true,
  })

  // ------------------------------------------------------------
  // Materials
  // ------------------------------------------------------------
  const [showMaterials, setShowMaterials] = useState(false)
  const [materials, setMaterials] = useState([])

  // ------------------------------------------------------------
  // Test-attached attributes (drag cards)
  // ------------------------------------------------------------
  const [attributes, setAttributes] = useState([])
  const [attrSearch, setAttrSearch] = useState('')
  const [attrLoading, setAttrLoading] = useState(false)
  const [attrModal, setAttrModal] = useState(false)
  const [editingAttr, setEditingAttr] = useState(null)
  const [attrForm, setAttrForm] = useState({
    attribute_name: '',
    unit: '',
    normal_range: '',
    is_active: true,
  })

  // ------------------------------------------------------------
  // Right-panel mode
  // ------------------------------------------------------------
  const [panelMode, setPanelMode] = useState('attribute')

  // ------------------------------------------------------------
  // Global Lab Attribute templates
  // ------------------------------------------------------------
  const [labAttributes, setLabAttributes] = useState([])
  const [selectedLabAttrId, setSelectedLabAttrId] = useState('')
  const [showLabAttrModal, setShowLabAttrModal] = useState(false)
  const [editingLabAttr, setEditingLabAttr] = useState(null)
  const [labAttrForm, setLabAttrForm] = useState({
    attribute_name: '',
    method_name: '',
    alias_names: '',
    unit: '',
    normal_range: '',
    is_long_text: false,
    suggest_results: false,
    options: [''],
    sub_category_id: '',
  })
  const [labAttrSaving, setLabAttrSaving] = useState(false)
  const [labAttrError, setLabAttrError] = useState('')

  // ------------------------------------------------------------
  // Sub-categories
  // ------------------------------------------------------------
  const [subCategories, setSubCategories] = useState([])
  const [showSubCatModal, setShowSubCatModal] = useState(false)
  const [editingSubCat, setEditingSubCat] = useState(null)
  const [subCatForm, setSubCatForm] = useState({ name: '' })
  const [subCatSaving, setSubCatSaving] = useState(false)
  const [subCatError, setSubCatError] = useState('')

  // ------------------------------------------------------------
  // New Department modal
  // ------------------------------------------------------------
  const [showDeptModal, setShowDeptModal] = useState(false)
  const [deptForm, setDeptForm] = useState({ name: '' })
  const [deptSaving, setDeptSaving] = useState(false)
  const [deptError, setDeptError] = useState('')

  // ------------------------------------------------------------
  // New Test modal
  // ------------------------------------------------------------
  const [showTestModal, setShowTestModal] = useState(false)
  const [newTestForm, setNewTestForm] = useState({
    test_name: '',
    service_code: '',
  })
  const [newTestSaving, setNewTestSaving] = useState(false)
  const [newTestError, setNewTestError] = useState('')

  // ------------------------------------------------------------
  // Drag & drop state
  // ------------------------------------------------------------
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragCardIdx, setDragCardIdx] = useState(null)
  const [dragOverCardIdx, setDragOverCardIdx] = useState(null)
  // Synchronous source of truth for card reordering (state updates are async)
  const dragIdxRef = useRef(null)
  // Synchronous locks so a fast double-click can't submit twice
  const savingRef = useRef(false)
  const newTestSavingRef = useRef(false)

  // ------------------------------------------------------------
  // Toast notification (success / error popup)
  // ------------------------------------------------------------
  const [toast, setToast] = useState(null) // { message, type }
  const toastTimerRef = useRef(null)

  const showToast = (message, type = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  // ============================================================
  // LOADERS
  // ============================================================
  const loadTests = async () => {
    setLoading(true)
    try {
      const res = await api.get('/lab-tests', {
        params: search ? { search } : {},
      })
      setTests(res.data || [])
      setAllTests(res.data || [])
    } catch (err) {
      console.error(err)
      setError('Failed to load lab tests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTests()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const loadDepartments = async () => {
    try {
      const res = await api.get('/departments')
      setDepartments(res.data || [])
    } catch (err) {
      console.error(err)
      setDepartments([])
    }
  }

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadLabAttributes = async () => {
    try {
      const res = await api.get('/lab-attributes')
      setLabAttributes(res.data || [])
    } catch (err) {
      console.error(err)
      setLabAttributes([])
    }
  }

  const loadSubCategories = async () => {
    try {
      const res = await api.get('/lab-attribute-subcategories')
      setSubCategories(res.data || [])
    } catch (err) {
      console.error(err)
      setSubCategories([])
    }
  }

  useEffect(() => {
    loadLabAttributes()
    loadSubCategories()
  }, [])

  const loadAttributes = async (testId) => {
    if (!testId) {
      setAttributes([])
      return
    }
    setAttrLoading(true)
    try {
      const res = await api.get(`/lab-tests/${testId}/detail`)
      setAttributes(res.data?.attributes || [])
    } catch (err) {
      console.error(err)
      setAttributes([])
    } finally {
      setAttrLoading(false)
    }
  }

  // ============================================================
  // MAIN FORM OPEN / CLOSE
  // ============================================================
  const openAdd = () => {
    setEditing(null)
    setForm({
      department_id: '',
      test_id: '',
      test_name: '',
      short_name: '',
      cost: '',
      referral_cost: 0,
      method: '',
      note: '',
      image: '',
      is_active: true,
    })
    setAttributes([])
    setMaterials([])
    setShowMaterials(false)
    setSelectedLabAttrId('')
    setPanelMode('attribute')
    setError('')
    setShowForm(true)
  }

  const openEdit = (test) => {
    setEditing(test)
    setForm({
      department_id: test.department_id ?? '',
      test_id: test.id ?? '',
      test_name: test.test_name || '',
      short_name: test.short_name || '',
      cost: test.cost ?? '',
      referral_cost: test.referral_cost ?? 0,
      method: test.method || '',
      note: test.note || '',
      image: test.image || '',
      is_active: !!test.is_active,
    })
    setMaterials(Array.isArray(test.materials) ? test.materials : [])
    setShowMaterials(
      Array.isArray(test.materials) && test.materials.length > 0
    )
    setPanelMode('attribute')
    setError('')
    setShowForm(true)
    loadAttributes(test.id)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
    setError('')
    setAttributes([])
    setMaterials([])
    setShowMaterials(false)
    dragIdxRef.current = null
    setDragCardIdx(null)
    setDragOverCardIdx(null)
  }

  // ============================================================
  // MATERIALS
  // ============================================================
  const addMaterialRow = () => {
    setShowMaterials(true)
    setMaterials((m) => [...m, { name: '', quantity: '', unit: '' }])
  }

  const updateMaterialRow = (idx, field, value) =>
    setMaterials((m) =>
      m.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    )

  const removeMaterialRow = (idx) =>
    setMaterials((m) => m.filter((_, i) => i !== idx))

  // ============================================================
  // SAVE MAIN TEST
  // ============================================================
  const handleSave = async () => {
    if (!form.test_name.trim() && !form.test_id) {
      setError('Please select a test or enter a test name')
      return false
    }
    if (savingRef.current) return false
    savingRef.current = true
    const isUpdate = !!(editing?.id || form.test_id)
    setSaving(true)
    setError('')
    try {
      const payload = {
        id: editing?.id || form.test_id || undefined,
        test_name: form.test_name.trim(),
        short_name: form.short_name.trim(),
        cost: form.cost,
        referral_cost: form.referral_cost,
        method: form.method,
        note: form.note,
        image: form.image,
        department_id: form.department_id || null,
        is_active: form.is_active,
        materials: materials
          .filter((r) => r.name.trim() || r.quantity || r.unit)
          .map((r) => ({
            name: r.name.trim(),
            quantity: String(r.quantity).trim(),
            unit: r.unit.trim(),
          })),
      }
      const res = await api.post('/lab-tests', payload)
      const savedId = editing?.id || form.test_id || res.data?.id

      if (savedId && !editing?.id) {
        setEditing({ id: savedId, test_name: form.test_name.trim() })
        setForm((f) => ({ ...f, test_id: savedId }))
        await loadAttributes(savedId)
      }

      await loadTests()
      showToast(
        isUpdate
          ? 'Lab test updated successfully'
          : 'Lab test saved successfully'
      )
      return true
    } catch (err) {
      console.error(err)
      setError(err?.response?.data?.error || 'Failed to save')
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleSaveAndClose = async () => {
    const ok = await handleSave()
    if (ok) closeForm()
  }

  const handleDelete = async (test) => {
    if (!window.confirm(`Delete lab test "${test.test_name}"?`)) return
    try {
      await api.delete(`/lab-tests/${test.id}`)
      loadTests()
    } catch (err) {
      console.error(err)
      alert('Failed to delete')
    }
  }

  const handleExport = async () => {
    try {
      const res = await api.get('/lab-tests/export')
      const rows = res.data || []
      if (!rows.length) return alert('No data to export')
      const headers = Object.keys(rows[0])
      const csv = [
        headers.join(','),
        ...rows.map((r) =>
          headers
            .map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`)
            .join(',')
        ),
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lab_tests_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      alert('Export failed')
    }
  }

  // ============================================================
  // TEST-ATTACHED ATTRIBUTES (modal)
  // ============================================================
  const openAttrAdd = () => {
    if (!editing?.id) {
      alert('Please save the Lab Test first, then add attributes.')
      return
    }
    setEditingAttr(null)
    setAttrForm({ attribute_name: '', unit: '', normal_range: '', is_active: true })
    setAttrModal(true)
  }

  const openAttrEdit = (attr) => {
    setEditingAttr(attr)
    setAttrForm({
      attribute_name: attr.attribute_name || '',
      unit: attr.unit || '',
      normal_range: attr.normal_range || '',
      is_active: !!attr.is_active,
    })
    setAttrModal(true)
  }

  const closeAttrModal = () => {
    setAttrModal(false)
    setEditingAttr(null)
  }

  const saveAttr = async () => {
    if (!attrForm.attribute_name.trim()) {
      alert('Attribute name is required')
      return
    }
    if (!editing?.id) {
      alert('Save the Lab Test first')
      return
    }
    try {
      await api.post(`/lab-tests/${editing.id}/attributes`, {
        id: editingAttr?.id,
        attribute_name: attrForm.attribute_name.trim(),
        unit: attrForm.unit.trim(),
        normal_range: attrForm.normal_range.trim(),
        is_active: attrForm.is_active,
      })
      closeAttrModal()
      loadAttributes(editing.id)
    } catch (err) {
      console.error(err)
      alert('Failed to save attribute')
    }
  }

  const deleteAttr = async (attr) => {
    if (!window.confirm(`Delete attribute "${attr.attribute_name}"?`)) return
    try {
      await api.delete(`/lab-tests/attributes/${attr.id}`)
      loadAttributes(editing.id)
    } catch (err) {
      console.error(err)
      alert('Failed to delete attribute')
    }
  }

  // ============================================================
  // DRAG & DROP — NEW attribute from right panel into drop zone
  // ============================================================
  const handleDragStart = (e, labAttr) => {
    if (!form.test_id && !editing?.id) {
      e.preventDefault()
      alert('Please select or save a Test first, then drag attributes.')
      return
    }
    dragIdxRef.current = null
    e.dataTransfer.setData('application/json', JSON.stringify(labAttr))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    // reordering a card -> "move"; new attribute from right panel -> "copy"
    e.dataTransfer.dropEffect = dragIdxRef.current !== null ? 'move' : 'copy'
    if (dragIdxRef.current === null && !isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    setIsDragOver(false)

    // A card was dropped on an empty gap (not on another card): ignore
    if (dragIdxRef.current !== null) return

    const currentTestId = form.test_id || editing?.id
    if (!currentTestId) {
      alert('Please select or save a Test first.')
      return
    }

    let labAttr
    try {
      labAttr = JSON.parse(e.dataTransfer.getData('application/json'))
    } catch {
      return
    }
    if (!labAttr || !labAttr.attribute_name) return

    const already = attributes.some(
      (a) =>
        (a.attribute_name || '').toLowerCase().trim() ===
        labAttr.attribute_name.toLowerCase().trim()
    )
    if (already) {
      alert(`"${labAttr.attribute_name}" is already added to this test.`)
      return
    }

    const tempId = `temp-${Date.now()}`
    const newRow = {
      id: tempId,
      attribute_name: labAttr.attribute_name,
      unit: labAttr.unit || '',
      normal_range: labAttr.normal_range || '',
      cost: labAttr.cost ?? 0,
      is_active: true,
      sort_order: attributes.length,
      _isNew: true,
    }
    setAttributes((prev) => [...prev, newRow])

    try {
      const res = await api.post(`/lab-tests/${currentTestId}/attributes`, {
        attribute_name: labAttr.attribute_name,
        unit: labAttr.unit || '',
        normal_range: labAttr.normal_range || '',
        cost: labAttr.cost ?? 0,
        is_active: true,
        sort_order: attributes.length,
      })
      setAttributes((prev) =>
        prev.map((r) =>
          r.id === tempId
            ? { ...r, id: res.data?.id ?? tempId, _isNew: false }
            : r
        )
      )
    } catch (err) {
      console.error('Failed to save dropped attribute', err)
      setAttributes((prev) => prev.filter((r) => r.id !== tempId))
      alert(
        err?.response?.data?.error || 'Failed to save attribute to the test.'
      )
    }
  }

  const updateDroppedAttr = (id, field, value) => {
    setAttributes((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  const persistDroppedAttr = async (row) => {
    const currentTestId = form.test_id || editing?.id
    if (!currentTestId || row._isNew) return
    try {
      await api.post(`/lab-tests/${currentTestId}/attributes`, {
        id: row.id,
        attribute_name: row.attribute_name,
        unit: row.unit || '',
        normal_range: row.normal_range || '',
        cost: row.cost ?? 0,
        is_active: row.is_active ?? true,
      })
    } catch (err) {
      console.error('Failed to update dropped attribute', err)
    }
  }

  const removeDroppedAttr = async (row) => {
    const currentTestId = form.test_id || editing?.id
    if (!row._isNew && row.id && !String(row.id).startsWith('temp-')) {
      try {
        await api.delete(`/lab-tests/attributes/${row.id}`)
      } catch (err) {
        console.error('Failed to delete attribute', err)
      }
    }
    setAttributes((prev) => prev.filter((r) => r.id !== row.id))
    if (currentTestId) loadAttributes(currentTestId)
  }

  // ============================================================
  // CARD REORDER — drag existing cards inside the drop zone
  // ============================================================
  const persistOrder = async (orderedList) => {
    const currentTestId = form.test_id || editing?.id
    if (!currentTestId) return

    const payload = {
      order: orderedList
        .filter((r) => r.id && !String(r.id).startsWith('temp-'))
        .map((r, i) => ({ id: Number(r.id), sort_order: i })),
    }

    try {
      await api.post(`/lab-tests/${currentTestId}/attributes/reorder`, payload)
    } catch (err) {
      console.error('[persistOrder] FAILED', err)
      await loadAttributes(currentTestId)
      alert(
        'Failed to save new order. ' +
          (err?.response?.data?.error || err.message)
      )
    }
  }

  const onGripDragStart = (idx) => (e) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))

    // Show the whole card as the drag preview, not just the little grip
    const card = e.currentTarget.closest('[data-attr-card]')
    if (card) e.dataTransfer.setDragImage(card, 24, 24)

    dragIdxRef.current = idx
    // Defer the re-render, otherwise Chrome cancels the drag
    setTimeout(() => setDragCardIdx(idx), 0)
  }

  const onGripDragEnd = () => {
    dragIdxRef.current = null
    setDragCardIdx(null)
    setDragOverCardIdx(null)
  }

  const onCardDragOver = (idx) => (e) => {
    // External drag (from right panel) -> let the drop zone handle it
    if (dragIdxRef.current === null) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCardIdx !== idx) setDragOverCardIdx(idx)

    // Auto-scroll while dragging near top/bottom of drop zone
    const zone = e.currentTarget.closest('.overflow-y-auto')
    if (zone) {
      const rect = zone.getBoundingClientRect()
      const threshold = 60
      const scrollStep = 20
      if (e.clientY - rect.top < threshold) {
        zone.scrollTop -= scrollStep
      } else if (rect.bottom - e.clientY < threshold) {
        zone.scrollTop += scrollStep
      }
    }
  }

  const onCardDragLeave = (e) => {
    if (dragIdxRef.current === null) return
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverCardIdx(null)
    }
  }

  const onCardDrop = (idx) => async (e) => {
    // External drag -> bubbles up to the drop zone's handleDrop
    if (dragIdxRef.current === null) return
    e.preventDefault()
    e.stopPropagation()

    const from = dragIdxRef.current
    const to = idx
    dragIdxRef.current = null
    setDragCardIdx(null)
    setDragOverCardIdx(null)
    if (from === to) return

    const next = [...attributes]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    setAttributes(next)

    await persistOrder(next)
  }

  // ============================================================
  // GLOBAL LAB ATTRIBUTE (modal)
  // ============================================================
  const openLabAttrModal = () => {
    setEditingLabAttr(null)
    setLabAttrForm({
      attribute_name: '',
      method_name: '',
      alias_names: '',
      unit: '',
      normal_range: '',
      is_long_text: false,
      suggest_results: false,
      options: [''],
      sub_category_id: '',
    })
    setLabAttrError('')
    setShowLabAttrModal(true)
  }

  const openLabAttrEdit = (attr) => {
    const testRow = attributes.find(
      (a) =>
        (a.attribute_name || '').toLowerCase().trim() ===
        (attr.attribute_name || '').toLowerCase().trim()
    )

    setEditingLabAttr(attr)
    setLabAttrForm({
      attribute_name: attr.attribute_name || '',
      method_name: attr.method_name || '',
      alias_names: attr.alias_names || '',
      unit: testRow?.unit ?? attr.unit ?? '',
      normal_range: testRow?.normal_range ?? attr.normal_range ?? '',
      is_long_text: !!attr.is_long_text,
      suggest_results: !!attr.suggest_results,
      options:
        Array.isArray(attr.options) && attr.options.length
          ? attr.options
          : [''],
      sub_category_id: attr.sub_category_id ?? '',
    })
    setLabAttrError('')
    setShowLabAttrModal(true)
  }

  const closeLabAttrModal = () => {
    setShowLabAttrModal(false)
    setEditingLabAttr(null)
    setLabAttrError('')
  }

  const addOptionRow = () =>
    setLabAttrForm((f) => ({ ...f, options: [...f.options, ''] }))

  const updateOptionRow = (idx, value) =>
    setLabAttrForm((f) => {
      const next = [...f.options]
      next[idx] = value
      return { ...f, options: next }
    })

  const removeOptionRow = (idx) =>
    setLabAttrForm((f) => ({
      ...f,
      options: f.options.filter((_, i) => i !== idx),
    }))

  const saveLabAttribute = async () => {
    if (!labAttrForm.attribute_name.trim()) {
      setLabAttrError('Lab-Attribute Name is required')
      return
    }
    setLabAttrSaving(true)
    setLabAttrError('')
    try {
      await api.post('/lab-attributes', {
        id: editingLabAttr?.id,
        attribute_name: labAttrForm.attribute_name.trim(),
        method_name: labAttrForm.method_name.trim(),
        alias_names: labAttrForm.alias_names.trim(),
        is_long_text: labAttrForm.is_long_text,
        suggest_results: labAttrForm.suggest_results,
        options: labAttrForm.options.filter((o) => o.trim() !== ''),
        sub_category_id: labAttrForm.sub_category_id || null,
      })
      await loadLabAttributes()
      setEditingLabAttr(null)
      closeLabAttrModal()
    } catch (err) {
      console.error('saveLabAttribute failed:', err)
      setLabAttrError(
        err?.response?.data?.error ||
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to save'
      )
    } finally {
      setLabAttrSaving(false)
    }
  }

  // ============================================================
  // SUB-CATEGORY (modal)
  // ============================================================
  const openSubCatModal = (subCat = null) => {
    setEditingSubCat(subCat)
    setSubCatForm({ name: subCat?.name || '' })
    setSubCatError('')
    setShowSubCatModal(true)
  }

  const closeSubCatModal = () => {
    setShowSubCatModal(false)
    setEditingSubCat(null)
    setSubCatError('')
  }

  const saveSubCategory = async () => {
    if (!subCatForm.name.trim()) {
      setSubCatError('Sub-Category Name is required')
      return
    }
    setSubCatSaving(true)
    setSubCatError('')
    try {
      const res = await api.post('/lab-attribute-subcategories', {
        id: editingSubCat?.id,
        name: subCatForm.name.trim(),
      })
      const savedId = editingSubCat?.id || res.data?.id
      await loadSubCategories()
      setLabAttrForm((f) => ({ ...f, sub_category_id: savedId || '' }))
      closeSubCatModal()
    } catch (err) {
      console.error(err)
      setSubCatError(err?.response?.data?.error || 'Failed to save')
    } finally {
      setSubCatSaving(false)
    }
  }

  // ============================================================
  // NEW DEPARTMENT
  // ============================================================
  const openDeptModal = () => {
    setDeptForm({ name: '' })
    setDeptError('')
    setShowDeptModal(true)
  }

  const closeDeptModal = () => {
    setShowDeptModal(false)
    setDeptError('')
  }

  const saveDepartment = async () => {
    if (!deptForm.name.trim()) {
      setDeptError('Department Name is required')
      return
    }
    setDeptSaving(true)
    setDeptError('')
    try {
      const res = await api.post('/departments', { name: deptForm.name.trim() })
      await loadDepartments()
      if (res.data?.id) setForm((f) => ({ ...f, department_id: res.data.id }))
      closeDeptModal()
    } catch (err) {
      console.error(err)
      setDeptError(err?.response?.data?.error || 'Failed to save department')
    } finally {
      setDeptSaving(false)
    }
  }

  // ============================================================
  // NEW TEST
  // ============================================================
  const openTestModal = () => {
    setNewTestForm({ test_name: '', service_code: '' })
    setNewTestError('')
    setShowTestModal(true)
  }

  const closeTestModal = () => {
    setShowTestModal(false)
    setNewTestError('')
  }

  const saveNewTest = async () => {
    if (!newTestForm.test_name.trim()) {
      setNewTestError('Test Name is required')
      return
    }
    if (!newTestForm.service_code.trim()) {
      setNewTestError('Service Code is required')
      return
    }
    if (newTestSavingRef.current) return
    newTestSavingRef.current = true
    setNewTestSaving(true)
    setNewTestError('')
    try {
      const res = await api.post('/lab-tests', {
        test_name: newTestForm.test_name.trim(),
        short_name: newTestForm.service_code.trim(),
        cost: 0,
        is_active: true,
      })
      const createdId = res.data?.id

      if (createdId) {
        setEditing({
          id: createdId,
          test_name: newTestForm.test_name.trim(),
        })
        setForm((f) => ({
          ...f,
          test_id: createdId,
          test_name: newTestForm.test_name.trim(),
          short_name: newTestForm.service_code.trim(),
        }))
        await loadAttributes(createdId)
      }

      await loadTests()
      closeTestModal()
    } catch (err) {
      console.error(err)
      setNewTestError(err?.response?.data?.error || 'Failed to save test')
    } finally {
      newTestSavingRef.current = false
      setNewTestSaving(false)
    }
  }

  // ============================================================
  // FILTERED LISTS
  // ============================================================
  const filteredLabAttributes = labAttributes.filter((a) =>
    (a.attribute_name || '').toLowerCase().includes(attrSearch.toLowerCase())
  )

  const filteredSubCategories = subCategories.filter((s) =>
    (s.name || '').toLowerCase().includes(attrSearch.toLowerCase())
  )

  // ============================================================
  // RENDER — BIG FORM VIEW
  // ============================================================
  const toastEl = toast ? (
    <div
      role="status"
      className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-sm shadow-lg text-sm text-white ${
        toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
      }`}
    >
      <span className="font-bold">{toast.type === 'error' ? '!' : '✓'}</span>
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => setToast(null)}
        className="ml-2 opacity-80 hover:opacity-100"
        title="Close"
      >
        ✕
      </button>
    </div>
  ) : null

  if (showForm) {
    return (
      <div>
        {toastEl}
        <PageHeader
          title="Lab Report"
          subtitle={editing?.id ? 'Edit Lab Test' : 'Add Lab Test'}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT — main form */}
          <div className="lg:col-span-2 bg-white border border-border rounded-sm shadow-sm">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">Lab Report</h3>
            </div>

            <div className="p-4 space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
                  {error}
                </div>
              )}

              {/* Department */}
              <div className="grid grid-cols-[140px_1fr_auto] items-center gap-3">
                <label className="text-xs font-semibold text-ink/80 text-right">
                  DEPARTMENT
                </label>
                <select
                  value={form.department_id}
                  onChange={(e) =>
                    setForm({ ...form, department_id: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">SELECT</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openDeptModal}
                  className="text-sm text-blue-500 hover:underline whitespace-nowrap"
                >
                  Add New
                </button>
              </div>

              {/* Test + Shortname + Cost */}
              <div className="grid grid-cols-[140px_1fr_auto_1fr_1fr] items-center gap-3">
                <label className="text-xs font-semibold text-ink/80 text-right">
                  TEST
                </label>
                <select
                  value={form.test_id}
                  onChange={(e) => {
                    const id = e.target.value
                    const picked = allTests.find(
                      (t) => String(t.id) === String(id)
                    )
                    setForm({
                      ...form,
                      test_id: id,
                      test_name: picked?.test_name || '',
                      short_name: picked?.short_name || form.short_name,
                      cost: picked?.cost ?? form.cost,
                    })
                    if (picked) setEditing(picked)
                    if (id) loadAttributes(id)
                  }}
                  className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">SELECT</option>
                  {allTests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.test_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openTestModal}
                  className="text-sm text-blue-500 hover:underline whitespace-nowrap"
                >
                  Add Test
                </button>
                <input
                  value={form.short_name}
                  onChange={(e) =>
                    setForm({ ...form, short_name: e.target.value })
                  }
                  placeholder="SHORTNAME"
                  className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <input
                  type="number"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                  placeholder="Cost"
                  className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              {/* Referral Cost + Specimen + Vacutainer */}
              <div className="grid grid-cols-[140px_1fr_120px_1fr_120px_1fr] items-center gap-3">
                <label className="text-xs font-semibold text-ink/80 text-right">
                  Referral Cost
                </label>
                <input
                  type="number"
                  value={form.referral_cost}
                  onChange={(e) =>
                    setForm({ ...form, referral_cost: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <label className="text-xs font-semibold text-ink/80 text-right">
                  Specimen
                </label>
                <select
                  value={form.method}
                  onChange={(e) =>
                    setForm({ ...form, method: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">Select</option>
                  <option value="Blood">Blood</option>
                  <option value="Urine">Urine</option>
                  <option value="Stool">Stool</option>
                  <option value="Serum">Serum</option>
                  <option value="Plasma">Plasma</option>
                </select>
                <label className="text-xs font-semibold text-ink/80 text-right">
                  Vacutainer
                </label>
                <input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Vacutainer"
                  className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-100"
                />
              </div>

              {/* ============================================
                  BIG, TALL, SCROLLABLE DROP ZONE
                 ============================================ */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`h-[600px] overflow-y-auto border rounded-sm p-4 space-y-3 transition-colors ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50/40'
                    : 'border-border bg-white'
                }`}
              >
                {attributes.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-ink/40 select-none">
                    Drag a Lab-Attribute from the right panel and drop it here
                  </div>
                ) : (
                  <>
                    {attributes.map((row, idx) => (
                      <div
                        key={row.id}
                        data-attr-card
                        onDragOver={onCardDragOver(idx)}
                        onDragLeave={onCardDragLeave}
                        onDrop={onCardDrop(idx)}
                        className={`relative border rounded-sm bg-white transition-opacity ${
                          dragCardIdx === idx ? 'opacity-40' : 'opacity-100'
                        } ${
                          dragOverCardIdx === idx && dragCardIdx !== idx
                            ? 'border-blue-500 border-2'
                            : 'border-border'
                        }`}
                      >
                        {/* Drop indicator at top of the card being hovered */}
                        {dragOverCardIdx === idx &&
                          dragCardIdx !== null &&
                          dragCardIdx !== idx && (
                            <div className="absolute -top-1.5 left-0 right-0 h-0.5 bg-blue-500 rounded-full pointer-events-none" />
                          )}

                        <div className="p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            {/* Whole header strip (grip + name + empty space) is the drag handle */}
                            <div
                              draggable
                              onDragStart={onGripDragStart(idx)}
                              onDragEnd={onGripDragEnd}
                              className="flex flex-1 items-center gap-2 py-1.5 cursor-grab active:cursor-grabbing select-none"
                              title="Drag to reorder"
                            >
                              <GripVertical
                                size={16}
                                className="text-ink/50 pointer-events-none shrink-0"
                              />
                              <span className="font-semibold text-sm pointer-events-none">
                                {row.attribute_name}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeDroppedAttr(row)}
                              className="w-6 h-6 flex items-center justify-center border border-border rounded-sm text-ink/60 hover:bg-red-50 hover:text-red-500"
                              title="Remove attribute"
                            >
                              ✕
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-ink/60 mb-1">
                                Units
                              </label>
                              <input
                                value={row.unit || ''}
                                onChange={(e) =>
                                  updateDroppedAttr(
                                    row.id,
                                    'unit',
                                    e.target.value
                                  )
                                }
                                onBlur={() => persistDroppedAttr(row)}
                                placeholder="Units"
                                className="w-full px-2 py-1.5 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-ink/60 mb-1">
                                Reference
                              </label>
                              <input
                                value={row.normal_range || ''}
                                onChange={(e) =>
                                  updateDroppedAttr(
                                    row.id,
                                    'normal_range',
                                    e.target.value
                                  )
                                }
                                onBlur={() => persistDroppedAttr(row)}
                                placeholder="Reference"
                                className="w-full px-2 py-1.5 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-ink/60 mb-1">
                                Cost
                              </label>
                              <input
                                type="number"
                                value={row.cost ?? ''}
                                onChange={(e) =>
                                  updateDroppedAttr(
                                    row.id,
                                    'cost',
                                    e.target.value
                                  )
                                }
                                onBlur={() => persistDroppedAttr(row)}
                                placeholder="Cost"
                                className="w-full px-2 py-1.5 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="h-40" />
                  </>
                )}
              </div>

              {/* Materials toggle & Add Material Qty */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={addMaterialRow}
                  className="px-3 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-sm"
                >
                  Add Material Qty
                </button>
              </div>

              {showMaterials && (
                <div className="border border-border rounded-sm">
                  <div className="grid grid-cols-[1fr_100px_110px_40px] gap-2 px-3 pt-3 pb-1">
                    <label className="text-xs font-medium">
                      <span className="text-red-500">*</span> Material Name
                    </label>
                    <label className="text-xs font-medium">
                      <span className="text-red-500">*</span> Quantity
                    </label>
                    <label className="text-xs font-medium">Units</label>
                    <span />
                  </div>

                  <div className="px-3 pb-3 space-y-2">
                    {materials.length === 0 && (
                      <p className="text-xs text-ink/50">
                        No materials added.
                      </p>
                    )}

                    {materials.map((row, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[1fr_100px_110px_40px] gap-2 items-center"
                      >
                        <input
                          value={row.name}
                          onChange={(e) =>
                            updateMaterialRow(idx, 'name', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-sm border border-border rounded-sm"
                        />
                        <input
                          type="number"
                          value={row.quantity}
                          onChange={(e) =>
                            updateMaterialRow(idx, 'quantity', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-sm border border-border rounded-sm bg-gray-100"
                        />
                        <input
                          value={row.unit}
                          onChange={(e) =>
                            updateMaterialRow(idx, 'unit', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-sm border border-border rounded-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeMaterialRow(idx)}
                          className="w-8 h-8 flex items-center justify-center border border-border rounded-sm hover:bg-red-50"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image + Active */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        image: e.target.files?.[0]?.name || '',
                      })
                    }
                    className="w-full text-sm"
                  />
                </div>
                <div className="flex items-end gap-2 pb-2">
                  <input
                    id="is_active"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                    className="rounded border-border"
                  />
                  <label htmlFor="is_active" className="text-sm">
                    Is Active
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-gray-50">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-sm border border-border rounded-sm hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-sm disabled:opacity-60"
              >
                {saving ? 'Saving...' : editing?.id ? 'Update' : 'Save'}
              </button>
              <button
                onClick={handleSaveAndClose}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700 rounded-sm disabled:opacity-60"
              >
                Save &amp; Close
              </button>
            </div>
          </div>

          {/* RIGHT — attributes / sub-category panel */}
          <div className="bg-white border border-border rounded-sm shadow-sm">
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={panelMode}
                  onChange={(e) => {
                    setPanelMode(e.target.value)
                    setAttrSearch('')
                    setSelectedLabAttrId('')
                  }}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium"
                >
                  <option value="attribute">Lab-Attribute</option>
                  <option value="subcategory">Sub-Category</option>
                </select>

                {panelMode === 'attribute' ? (
                  <button
                    onClick={openLabAttrModal}
                    className="px-3 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-sm whitespace-nowrap"
                  >
                    Add Attribute
                  </button>
                ) : (
                  <button
                    onClick={() => openSubCatModal(null)}
                    className="px-3 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-sm whitespace-nowrap"
                  >
                    Add Sub-Category
                  </button>
                )}
              </div>

              <div className="relative">
                <input
                  value={attrSearch}
                  onChange={(e) => setAttrSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full pl-3 pr-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              <div className="max-h-[520px] overflow-y-auto border border-border rounded-sm divide-y divide-border">
                {panelMode === 'attribute' && (
                  <>
                    {filteredLabAttributes.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-ink/50">
                        No lab attributes yet
                      </div>
                    ) : (
                      filteredLabAttributes.map((a) => (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, a)}
                          className={`flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-blue-50/40 ${
                            String(selectedLabAttrId) === String(a.id)
                              ? 'bg-blue-50'
                              : ''
                          }`}
                          title="Drag into the white area on the left"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedLabAttrId(a.id)}
                            className="flex-1 text-left"
                          >
                            <div className="text-sm font-medium truncate">
                              {a.attribute_name}
                            </div>
                          </button>
                          <button
                            onClick={() => openLabAttrEdit(a)}
                            title="Edit"
                            className="p-1 rounded hover:bg-blue-100"
                          >
                            <Pencil size={14} className="text-blue-500" />
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}

                {panelMode === 'subcategory' && (
                  <>
                    {filteredSubCategories.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-ink/50">
                        No sub-categories yet
                      </div>
                    ) : (
                      filteredSubCategories.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between px-3 py-2 hover:bg-blue-50/40"
                        >
                          <span className="flex-1 text-sm font-medium truncate">
                            {s.name}
                          </span>
                          <button
                            onClick={() => openSubCatModal(s)}
                            title="Edit"
                            className="p-1 rounded hover:bg-blue-100"
                          >
                            <Pencil size={14} className="text-blue-500" />
                          </button>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ---------- Modals ---------- */}

        {/* Test-attribute attach/edit modal */}
        {attrModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-md rounded-sm shadow-lg border border-border">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-base">
                  {editingAttr ? 'Edit Attribute' : 'Add Attribute'}
                </h3>
                <button
                  onClick={closeAttrModal}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 py-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Attribute Name *
                  </label>
                  <input
                    value={attrForm.attribute_name}
                    onChange={(e) =>
                      setAttrForm({
                        ...attrForm,
                        attribute_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Unit
                  </label>
                  <input
                    value={attrForm.unit}
                    onChange={(e) =>
                      setAttrForm({ ...attrForm, unit: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    Normal Range
                  </label>
                  <input
                    value={attrForm.normal_range}
                    onChange={(e) =>
                      setAttrForm({ ...attrForm, normal_range: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="attr_active"
                    type="checkbox"
                    checked={attrForm.is_active}
                    onChange={(e) =>
                      setAttrForm({ ...attrForm, is_active: e.target.checked })
                    }
                  />
                  <label htmlFor="attr_active" className="text-sm">
                    Active
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-gray-50">
                {editingAttr && (
                  <button
                    onClick={() => {
                      closeAttrModal()
                      deleteAttr(editingAttr)
                    }}
                    className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-sm mr-auto"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={closeAttrModal}
                  className="px-4 py-2 text-sm border border-border rounded-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={saveAttr}
                  className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-sm"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit Lab Attribute modal */}
        {showLabAttrModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
            <div className="bg-white w-full max-w-3xl rounded-sm shadow-lg border border-border">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h3 className="font-semibold text-base">
                  {editingLabAttr ? 'Edit LabAttribute' : 'Add LabAttribute'}
                </h3>
                <button
                  onClick={closeLabAttrModal}
                  className="p-1 rounded hover:bg-gray-100 text-ink/50"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
                {labAttrError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
                    {labAttrError}
                  </div>
                )}

                <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                  <label className="text-sm font-semibold text-ink/80">
                    <span className="text-red-500">*</span> Lab-Attribute Name :
                  </label>
                  <input
                    value={labAttrForm.attribute_name}
                    onChange={(e) =>
                      setLabAttrForm({
                        ...labAttrForm,
                        attribute_name: e.target.value,
                      })
                    }
                    placeholder="Lab-Attribute Name"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                  <label className="text-sm font-semibold text-ink/80">
                    Method Name :
                  </label>
                  <input
                    value={labAttrForm.method_name}
                    onChange={(e) =>
                      setLabAttrForm({
                        ...labAttrForm,
                        method_name: e.target.value,
                      })
                    }
                    placeholder="Method Name"
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                <div className="grid grid-cols-[200px_1fr] items-start gap-4">
                  <label className="text-sm font-semibold text-ink/80 flex items-center gap-1 pt-2">
                    Alias Names
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-400 text-white text-[10px] font-bold"
                      title="Aliases are alternative names used to search this attribute."
                    >
                      i
                    </span>
                    :
                  </label>
                  <textarea
                    rows={2}
                    value={labAttrForm.alias_names}
                    onChange={(e) =>
                      setLabAttrForm({
                        ...labAttrForm,
                        alias_names: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                  />
                </div>

                <div className="grid grid-cols-[200px_1fr] items-start gap-4">
                  <label className="text-sm font-semibold text-ink/80 pt-1">
                    Is Long Text :
                  </label>
                  <input
                    type="checkbox"
                    checked={labAttrForm.is_long_text}
                    onChange={(e) =>
                      setLabAttrForm({
                        ...labAttrForm,
                        is_long_text: e.target.checked,
                      })
                    }
                    className="mt-1 rounded border-border"
                  />
                </div>

                <div className="grid grid-cols-[200px_1fr] items-start gap-4">
                  <label className="text-sm font-semibold text-ink/80 pt-1">
                    Suggest Results :
                  </label>
                  <input
                    type="checkbox"
                    checked={labAttrForm.suggest_results}
                    onChange={(e) =>
                      setLabAttrForm({
                        ...labAttrForm,
                        suggest_results: e.target.checked,
                      })
                    }
                    className="mt-1 rounded border-border"
                  />
                </div>

                <div className="grid grid-cols-[200px_1fr] items-center gap-4">
                  <label className="text-sm font-semibold text-ink/80">
                    Sub-Category :
                  </label>
                  <select
                    value={labAttrForm.sub_category_id}
                    onChange={(e) =>
                      setLabAttrForm({
                        ...labAttrForm,
                        sub_category_id: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="">Select</option>
                    {subCategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between bg-[#4a6fb5] text-white px-4 py-2 rounded-t-sm">
                    <span className="font-semibold text-sm">Options</span>
                    <button
                      type="button"
                      onClick={addOptionRow}
                      className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-400 hover:bg-blue-300 text-white"
                      title="Add Option"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="border border-t-0 border-border rounded-b-sm p-3 min-h-[140px] space-y-2">
                    {labAttrForm.options.length === 0 && (
                      <p className="text-xs text-ink/40 text-center pt-10">
                        No options yet. Click <strong>+</strong> above to add one.
                      </p>
                    )}

                    {labAttrForm.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          value={opt}
                          onChange={(e) => updateOptionRow(idx, e.target.value)}
                          placeholder={`Option ${idx + 1}`}
                          className="flex-1 px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => removeOptionRow(idx)}
                          className="p-2 rounded hover:bg-red-50"
                          title="Remove"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative px-6 py-3 border-t border-border bg-gray-50">
                <div className="flex justify-center">
                  <button
                    onClick={saveLabAttribute}
                    disabled={labAttrSaving}
                    className="px-6 py-2 text-sm text-white bg-[#4a90e2] hover:bg-[#3b7dd8] rounded-sm disabled:opacity-60"
                  >
                    {labAttrSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <button
                  onClick={closeLabAttrModal}
                  className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 text-sm border border-border rounded-sm bg-gray-200 hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add / Edit Sub-Category modal */}
        {showSubCatModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
            <div className="bg-white w-full max-w-md rounded-sm shadow-lg border border-border">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-base">
                  Add / Edit Sub-Category
                </h3>
                <button
                  onClick={closeSubCatModal}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 py-4 space-y-3">
                {subCatError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
                    {subCatError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    * Sub-Category Name :
                  </label>
                  <input
                    value={subCatForm.name}
                    onChange={(e) =>
                      setSubCatForm({ name: e.target.value })
                    }
                    placeholder="Sub-Category Name"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-gray-50">
                <button
                  onClick={closeSubCatModal}
                  className="px-4 py-2 text-sm border border-border rounded-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSubCategory}
                  disabled={subCatSaving}
                  className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-sm disabled:opacity-60"
                >
                  {subCatSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Department modal */}
        {showDeptModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-md rounded-sm shadow-lg border border-border">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-base">New Department</h3>
                <button
                  onClick={closeDeptModal}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 py-4 space-y-3">
                {deptError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
                    {deptError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    * Department Name :
                  </label>
                  <input
                    value={deptForm.name}
                    onChange={(e) =>
                      setDeptForm({ ...deptForm, name: e.target.value })
                    }
                    placeholder="Department Name"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-gray-50">
                <button
                  onClick={closeDeptModal}
                  className="px-4 py-2 text-sm border border-border rounded-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={saveDepartment}
                  disabled={deptSaving}
                  className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-sm disabled:opacity-60"
                >
                  {deptSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Test modal */}
        {showTestModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white w-full max-w-md rounded-sm shadow-lg border border-border">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold text-base">New Test</h3>
                <button
                  onClick={closeTestModal}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 py-4 space-y-3">
                {newTestError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
                    {newTestError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    * Test Name :
                  </label>
                  <input
                    value={newTestForm.test_name}
                    onChange={(e) =>
                      setNewTestForm({
                        ...newTestForm,
                        test_name: e.target.value,
                      })
                    }
                    placeholder="Test Name"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink/70 mb-1">
                    * Service Code :
                  </label>
                  <input
                    value={newTestForm.service_code}
                    onChange={(e) =>
                      setNewTestForm({
                        ...newTestForm,
                        service_code: e.target.value,
                      })
                    }
                    placeholder="Service Code"
                    className="w-full px-3 py-2 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-4 py-3 border-t border-border bg-gray-50">
                <button
                  onClick={closeTestModal}
                  className="px-4 py-2 text-sm border border-border rounded-sm hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNewTest}
                  disabled={newTestSaving}
                  className="px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded-sm disabled:opacity-60"
                >
                  {newTestSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // RENDER — LIST VIEW
  // ============================================================
  return (
    <div>
      {toastEl}
      <PageHeader title="Lab Tests" subtitle="Masters / Lab Test" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={openAdd}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-sm shadow-sm"
        >
          Add Lab Test
        </button>
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-sm shadow-sm"
        >
          Export Excel
        </button>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-ink/70">Search:</label>
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-400 w-64"
            />
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-ink/40"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-sm shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#4aa3df] text-white">
              <th className="text-left px-3 py-2 font-semibold">Test</th>
              <th className="text-left px-3 py-2 font-semibold w-48">
                Short Name
              </th>
              <th className="text-left px-3 py-2 font-semibold w-32">
                Cost(₹)
              </th>
              <th className="text-left px-3 py-2 font-semibold w-24">
                Status
              </th>
              <th className="text-left px-3 py-2 font-semibold w-24">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink/50">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && tests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink/50">
                  No lab tests found
                </td>
              </tr>
            )}
            {!loading &&
              tests.map((t, idx) => (
                <tr
                  key={t.id}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                >
                  <td className="px-3 py-1.5 border-b border-border/60">
                    {t.test_name}
                  </td>
                  <td className="px-3 py-1.5 border-b border-border/60">
                    {t.short_name || ''}
                  </td>
                  <td className="px-3 py-1.5 border-b border-border/60">
                    {Number(t.cost || 0).toFixed(0)}
                  </td>
                  <td className="px-3 py-1.5 border-b border-border/60">
                    <span
                      className={
                        t.is_active ? 'text-green-600' : 'text-red-500'
                      }
                    >
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        title="Edit"
                        className="p-1 rounded hover:bg-blue-50"
                      >
                        <Pencil size={14} className="text-blue-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        title="Delete"
                        className="p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}