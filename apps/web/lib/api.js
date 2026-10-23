import axios from 'axios';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

export default apiClient;

// Auth API
export const authApi = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout'),
  forgotPassword: (data) => apiClient.post('/auth/forgot-password', data),
  resetPassword: (data) => apiClient.post('/auth/reset-password', data),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  changePassword: (data) => apiClient.put('/auth/password', data),
  googleAuth: () => apiClient.get('/auth/google'),
  facebookAuth: () => apiClient.get('/auth/facebook'),
};

// Products API
export const productsApi = {
  getAll: (params) => apiClient.get('/products', { params }),
  getAdminAll: (params) => apiClient.get('/products/admin/all', { params }),
  getNewArrivals: (params) => apiClient.get('/products/new-arrivals', { params }),
  getBestSellers: (params) => apiClient.get('/products/best-sellers', { params }),
  getFilters: () => apiClient.get('/products/filters'),
  getById: (id) => apiClient.get(`/products/${id}`),
  getBySlug: (slug) => apiClient.get(`/products/slug/${slug}`),
  search: (q, params = {}) => apiClient.get('/products/search', { params: { q, ...params } }),
  create: (data) => apiClient.post('/products', data),
  update: (id, data) => apiClient.put(`/products/${id}`, data),
  delete: (id) => apiClient.delete(`/products/${id}`),
  addVariant: (productId, data) => apiClient.post(`/products/${productId}/variants`, data),
  updateVariant: (productId, variantId, data) =>
    apiClient.put(`/products/${productId}/variants/${variantId}`, data),
  updateVariantInventory: (variantId, inventory) =>
    apiClient.put(`/products/variants/${variantId}/inventory`, { inventory }),
  deleteVariant: (productId, variantId) =>
    apiClient.delete(`/products/${productId}/variants/${variantId}`),
};

// Categories API
export const categoriesApi = {
  getAll: () => apiClient.get('/categories'),
  getById: (id) => apiClient.get(`/categories/${id}`),
  create: (data) => apiClient.post('/categories', data),
  update: (id, data) => apiClient.put(`/categories/${id}`, data),
  delete: (id) => apiClient.delete(`/categories/${id}`),
};

// Cart API
export const cartApi = {
  getCart: () => apiClient.get('/cart'),
  addItem: (data) => apiClient.post('/cart/items', data),
  updateItem: (itemId, data) => apiClient.put(`/cart/items/${itemId}`, data),
  removeItem: (itemId) => apiClient.delete(`/cart/items/${itemId}`),
  clearCart: () => apiClient.delete('/cart'),
};

// Orders API
export const ordersApi = {
  create: (data) => apiClient.post('/orders', data),
  getAll: () => apiClient.get('/orders'),
  getAdminAll: (params) => apiClient.get('/orders/admin/all', { params }),
  getById: (id) => apiClient.get(`/orders/${id}`),
  getByOrderNumber: (orderNumber) => apiClient.get(`/orders/number/${orderNumber}`),
  updateStatus: (id, status, note) => apiClient.put(`/orders/${id}/status`, { status, note }),
};

// Addresses API (Customer)
export const addressesApi = {
  getAll: () => apiClient.get('/users/addresses'),
  create: (data) => apiClient.post('/users/addresses', data),
  update: (id, data) => apiClient.put(`/users/addresses/${id}`, data),
  setDefault: (id) => apiClient.put(`/users/addresses/${id}/default`),
  delete: (id) => apiClient.delete(`/users/addresses/${id}`),
};

// Discounts API
export const discountsApi = {
  validate: (code, params) => apiClient.get(`/discounts/validate/${code}`, { params }),
  getAll: () => apiClient.get('/discounts'),
  getById: (id) => apiClient.get(`/discounts/${id}`),
  create: (data) => apiClient.post('/discounts', data),
  update: (id, data) => apiClient.put(`/discounts/${id}`, data),
  delete: (id) => apiClient.delete(`/discounts/${id}`),
};

// Reviews API
export const reviewsApi = {
  getByProduct: (productId) => apiClient.get(`/reviews/product/${productId}`),
  create: (data) => apiClient.post('/reviews', data),
  update: (id, data) => apiClient.put(`/reviews/${id}`, data),
  delete: (id) => apiClient.delete(`/reviews/${id}`),
};

// Loyalty API
export const loyaltyApi = {
  getPoints: () => apiClient.get('/loyalty/points'),
  getHistory: () => apiClient.get('/loyalty/history'),
};

// Users API (Admin)
export const usersApi = {
  getAll: (params) => apiClient.get('/users', { params }),
  getById: (id) => apiClient.get(`/users/${id}`),
  update: (id, data) => apiClient.put(`/users/${id}`, data),
  ban: (id) => apiClient.put(`/users/${id}/ban`),
  unban: (id) => apiClient.put(`/users/${id}/unban`),
};

// Analytics API (Admin)
export const analyticsApi = {
  getSimpleDashboard: () => apiClient.get('/analytics/simple'),
  getAdvancedDashboard: (params) => apiClient.get('/analytics/advanced', { params }),
};

// Elasticsearch Search API (Phase 6 Bonus)
export const searchApi = {
  search: (params) => apiClient.get('/search/elasticsearch', { params }),
  suggest: (q, limit = 6) => apiClient.get('/search/suggest', { params: { q, limit } }),
  health: () => apiClient.get('/search/health'),
  reindex: () => apiClient.post('/search/reindex'),
  benchmark: (params) => apiClient.get('/search/benchmark', { params }),
};

// AI Features API (Phase 6 Bonus)
export const aiApi = {
  chat: (data) => apiClient.post('/ai/chat', data),
  imageSearch: (data) => apiClient.post('/ai/image-search', data),
  analyzeSentiment: (data) => apiClient.post('/ai/sentiment', data),
  getProductSentiment: (productId) => apiClient.get(`/ai/sentiment/product/${productId}`),
};

// Microservices & Gateway API (Phase 6 Bonus)
export const microservicesApi = {
  getStatus: () => apiClient.get('/microservices/status'),
  publishEvent: (data) => apiClient.post('/microservices/events/publish', data),
  getEventHistory: (limit = 25) =>
    apiClient.get('/microservices/events/history', { params: { limit } }),
};
