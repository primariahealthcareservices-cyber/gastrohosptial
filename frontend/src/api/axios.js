import axios from 'axios'

// Point directly to your Flask backend
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ============================================================
// Inventory Type API
// ============================================================
export const inventoryTypeApi = {
  getAll: async ({ search = '', page = 1, limit = 10 } = {}) => {
    const response = await api.get('/pharmacy/inventory-types', {
      params: { search, page, limit }
    })
    return response.data
  },

  getAllActive: async () => {
    const response = await api.get('/pharmacy/inventory-types/all')
    return response.data
  },

  create: async (name, is_active = true) => {
    const response = await api.post('/pharmacy/inventory-types', { name, is_active })
    return response.data
  },

  update: async (id, name, is_active = true) => {
    const response = await api.put(`/pharmacy/inventory-types/${id}`, { name, is_active })
    return response.data
  },

  delete: async (id) => {
    const response = await api.delete(`/pharmacy/inventory-types/${id}`)
    return response.data
  },
}

// ============================================================
// Item Type API
// ============================================================
export const itemTypeApi = {
  getAll: async ({ search = '', page = 1, limit = 10 } = {}) => {
    const response = await api.get('/pharmacy/item-types', {
      params: { search, page, limit }
    })
    return response.data
  },

  create: async (name, inventory_type_id, is_active = true) => {
    const response = await api.post('/pharmacy/item-types', {
      name, inventory_type_id, is_active
    })
    return response.data
  },

  update: async (id, name, inventory_type_id, is_active = true) => {
    const response = await api.put(`/pharmacy/item-types/${id}`, {
      name, inventory_type_id, is_active
    })
    return response.data
  },

  delete: async (id) => {
    const response = await api.delete(`/pharmacy/item-types/${id}`)
    return response.data
  },

  getInventoryTypes: async () => {
    const response = await api.get('/pharmacy/item-types/inventory-types-dropdown')
    return response.data
  },
}

// ============================================================
// Supplier API
// ============================================================
export const supplierApi = {
  getAll: async ({ search = '', page = 1, limit = 10 } = {}) => {
    const response = await api.get('/suppliers', {
      params: { search, page, limit }
    })
    return response.data
  },

  get: async (id) => {
    const response = await api.get(`/suppliers/${id}`)
    return response.data
  },

  create: async (payload) => {
    const response = await api.post('/suppliers', payload)
    return response.data
  },

  update: async (payload) => {
    // Backend upserts: if payload.id exists → UPDATE, else → INSERT
    const response = await api.post('/suppliers', payload)
    return response.data
  },

  delete: async (id) => {
    const response = await api.delete(`/suppliers/${id}`)
    return response.data
  },
}

// ============================================================
// Manufacturer API
// ============================================================
export const manufacturerApi = {
  getAll: async ({ search = '', page = 1, limit = 10 } = {}) => {
    const response = await api.get('/manufacturers', {
      params: { search, page, limit }
    })
    return response.data
  },

  get: async (id) => {
    const response = await api.get(`/manufacturers/${id}`)
    return response.data
  },

  create: async (payload) => {
    const response = await api.post('/manufacturers', payload)
    return response.data
  },

  update: async (payload) => {
    const response = await api.post('/manufacturers', payload)
    return response.data
  },

  delete: async (id) => {
    const response = await api.delete(`/manufacturers/${id}`)
    return response.data
  },
}

// ============================================================
// Purchase Order API
// ============================================================
export const purchaseOrderApi = {
  getAll: async ({ search = '', start_date, end_date, page = 1, limit = 10 } = {}) => {
    const response = await api.get('/purchase-orders', {
      params: { search, start_date, end_date, page, limit }
    })
    return response.data
  },

  get: async (id) => {
    const response = await api.get(`/purchase-orders/${id}`)
    return response.data
  },

  nextNo: async () => {
    const response = await api.get('/purchase-orders/next-no')
    return response.data
  },

  create: async (payload) => {
    const response = await api.post('/purchase-orders', payload)
    return response.data
  },

  update: async (id, payload) => {
    const response = await api.put(`/purchase-orders/${id}`, payload)
    return response.data
  },

  cancel: async (id) => {
    const response = await api.post(`/purchase-orders/${id}/cancel`)
    return response.data
  },
}

// ============================================================
// Pharmacy Items API
// ============================================================
export const itemApi = {
  getAllNames: async () => {
    const response = await api.get('/pharmacy/item-types/all-names')   // ← changed
    return response.data
  },
  search: async (search = '') => {
    const response = await api.get('/pharmacy-items', { params: { search } })
    return response.data
  },
}

// ============================================================
// Pharmacy Patient Indents API
// ============================================================
export const pharmacyPatientIndentApi = {
  getAll: async (search = '') => {
    const response = await api.get('/pharmacy-patient-indents', { params: { search } })
    return response.data
  },
  create: async (payload) => {
    const response = await api.post('/pharmacy-patient-indents', payload)
    return response.data
  }
}

// ============================================================
// Duplicate Invoice API (NEW)
// ============================================================
export const duplicateInvoiceApi = {
  getOpInvoices: async (params) => {
    const response = await api.get('/pharmacy-duplicate-invoice/op', { params })
    return response.data
  },
  getIpInvoices: async (params) => {
    const response = await api.get('/pharmacy-duplicate-invoice/ip', { params })
    return response.data
  },
  getReturnsInvoices: async (params) => {
    const response = await api.get('/pharmacy-duplicate-invoice/returns', { params })
    return response.data
  },
  getOpDetails: async (invoice_id) => {
    const response = await api.get('/pharmacy-duplicate-invoice/op/details', { params: { invoice_id } })
    return response.data
  },
  getIpDetails: async (invoice_id) => {
    const response = await api.get('/pharmacy-duplicate-invoice/ip/details', { params: { invoice_id } })
    return response.data
  },
  getReturnsDetails: async (invoice_id) => {
    const response = await api.get('/pharmacy-duplicate-invoice/returns/details', { params: { invoice_id } })
    return response.data
  },
  // 🔴 NEW: Update Invoice Endpoint
  updateInvoice: async (payload) => {
    const response = await api.post('/pharmacy-duplicate-invoice/update', payload)
    return response.data
  }
}
// ============================================================
// Company Due Collection API
// ============================================================
export const companyDueCollectionApi = {
  getReport: async (params) => {
    // params: { start_date, end_date, company_name }
    const response = await api.get('/company-due-collection/', { params })
    return response.data
  }
}
// ============================================================
// OP / IP Due Collection API
// ============================================================
export const opIpDueCollectionApi = {
  // Fetch list of patients based on type (INPATIENT, OUTPATIENT, DIRECT)
  getPatients: async (params) => {
    const response = await api.get('/op-ip-due-collection/patients', { params })
    return response.data
  },
  // Fetch specific patient details and due invoices
  getPatientDetails: async (reg_no) => {
    const response = await api.get('/op-ip-due-collection/details', { params: { reg_no } })
    return response.data
  },
  // Submit payment collection
  collectPayment: async (payload) => {
    const response = await api.post('/op-ip-due-collection/collect', payload)
    return response.data
  }
}
// ============================================================
// Insurance Due Collection API
// ============================================================
export const insuranceDueCollectionApi = {
  // Fetch insurance companies for dropdown
  getInsuranceCompanies: async () => {
    const response = await api.get('/insurance-due-collection/companies')
    return response.data
  },
  // Fetch due report based on filters
  getReport: async (params) => {
    const response = await api.get('/insurance-due-collection/', { params })
    return response.data
  }
}
// ============================================================
// Item Stock API
// ============================================================
export const itemStockApi = {
  getStock: async (params) => {
    // params: { item_type, search }
    const response = await api.get('/item-stock/', { params })
    return response.data
  }
}

export default api