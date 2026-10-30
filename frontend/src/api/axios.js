import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
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

// --- INVENTORY TYPES ---
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

// --- ITEM TYPES ---
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

// --- SUPPLIERS ---
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
    const response = await api.post('/suppliers', payload)
    return response.data
  },
  delete: async (id) => {
    const response = await api.delete(`/suppliers/${id}`)
    return response.data
  },
}

// --- MANUFACTURERS ---
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

// --- PURCHASE ORDERS ---
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

// --- ITEM STOCK ---
export const itemApi = {
  getAllNames: async () => {
    const response = await api.get('/item-stock/all-names')
    return response.data
  },
  search: async (search = '') => {
    const response = await api.get('/pharmacy-items', { params: { search } })
    return response.data
  },
}

export const itemStockApi = {
  getAll: async ({ search = '', page = 1, limit = 50 } = {}) => {
    const response = await api.get('/item-stock', {
      params: { search, page, limit }
    })
    return response.data
  },
  create: async (payload) => {
    const response = await api.post('/item-stock', payload)
    return response.data
  },
  // NEW: Update method
  update: async (id, payload) => {
    const response = await api.put(`/item-stock/${id}`, payload)
    return response.data
  }
}

// --- REPORTS ---
export const totalSalesReportApi = {
  getSummary: async ({ start_date, end_date, include_expenses }) => {
    const response = await api.get('/reports/total-sales-summary', {
      params: { start_date, end_date, include_expenses: include_expenses ? 1 : 0 }
    })
    return response.data
  },
  getDetails: async ({ start_date, end_date, sale_type }) => {
    const response = await api.get('/reports/total-sales-details', {
      params: { start_date, end_date, sale_type }
    })
    return response.data
  }
}

export default api