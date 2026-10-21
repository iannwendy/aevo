import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Requests carry the session through the httpOnly cookie the browser sends
// automatically (withCredentials). No Authorization header is built here:
// document.cookie can never see that token anyway.

// Response interceptor
// A 401 marks a request that needs a signed-in user. Callers handle it (and
// choose where to send the visitor); redirecting the window here would bounce
// public pages - and "wrong password" replies - to /login.
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
  getById: (id) => apiClient.get(`/products/${id}`),
  getBySlug: (slug) => apiClient.get(`/products/slug/${slug}`),
  search: (q) => apiClient.get('/products/search', { params: { q } }),
};

// Categories API
export const categoriesApi = {
  getAll: () => apiClient.get('/categories'),
  getById: (id) => apiClient.get(`/categories/${id}`),
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
  getById: (id) => apiClient.get(`/orders/${id}`),
  updateStatus: (id, status) => apiClient.put(`/orders/${id}/status`, { status }),
};

// Discounts API
export const discountsApi = {
  validate: (code) => apiClient.get(`/discounts/validate/${code}`),
  getAll: () => apiClient.get('/discounts'),
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
