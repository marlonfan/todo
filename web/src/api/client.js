import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (data) => apiClient.post('/auth/login', data),
  register: (data) => apiClient.post('/auth/register', data),
  me: () => apiClient.get('/auth/me'),
  refresh: () => apiClient.post('/auth/refresh'),
  updateProfile: (data) => apiClient.patch('/auth/profile', data),
};

function withIfMatch(options = {}) {
  const revision = Number(options?.ifMatchRevision || 0);
  if (!revision) return {};
  return {
    headers: {
      'If-Match': String(revision),
    },
  };
}

// Tasks API
export const tasksAPI = {
  list: (params) => apiClient.get('/tasks', { params }),
  get: (id) => apiClient.get(`/tasks/${id}`),
  create: (data) => apiClient.post('/tasks', data),
  update: (id, data, options = {}) => apiClient.put(`/tasks/${id}`, data, withIfMatch(options)),
  delete: (id, options = {}) => apiClient.delete(`/tasks/${id}`, withIfMatch(options)),
  updateStatus: (id, dataOrStatus, options = {}) => {
    const payload =
      typeof dataOrStatus === 'string'
        ? { status: dataOrStatus }
        : dataOrStatus;
    return apiClient.patch(`/tasks/${id}/status`, payload, withIfMatch(options));
  },
  updateSchedule: (id, data, options = {}) => apiClient.patch(`/tasks/${id}/schedule`, data, withIfMatch(options)),
  getInstances: (id, params) => apiClient.get(`/tasks/${id}/instances`, { params }),
  // Task notification
  listNotifications: (taskId) => apiClient.get(`/tasks/${taskId}/notifications`),
  createNotification: (taskId, data) => apiClient.post(`/tasks/${taskId}/notifications`, data),
};

// Categories API
export const categoriesAPI = {
  list: () => apiClient.get('/categories'),
  get: (id) => apiClient.get(`/categories/${id}`),
  create: (data) => apiClient.post('/categories', data),
  update: (id, data) => apiClient.put(`/categories/${id}`, data),
  delete: (id) => apiClient.delete(`/categories/${id}`),
};

// Calendar API
export const calendarAPI = {
  getEvents: (params) => apiClient.get('/calendar', { params }),
};

// Notifications API
export const notifyAPI = {
  getSettings: () => apiClient.get('/notify/settings'),
  createSetting: (data) => apiClient.post('/notify/settings', data),
  deleteSetting: (id) => apiClient.delete(`/notify/settings/${id}`),
  setDefaultSetting: (id) => apiClient.patch(`/notify/settings/${id}/default`),
  test: (data) => apiClient.post('/notify/test', data),
  getChannels: () => apiClient.get('/notify/channels'),
};

export default apiClient;
