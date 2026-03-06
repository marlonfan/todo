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

function withTaskMutationHeaders(options = {}) {
  const headers = {};
  const revision = Number(options?.ifMatchRevision || 0);
  if (revision) {
    headers['If-Match'] = String(revision);
  }
  const submittedAt = typeof options?.clientSubmittedAt === 'string'
    ? options.clientSubmittedAt.trim()
    : '';
  if (submittedAt) {
    headers['X-Client-Submitted-At'] = submittedAt;
  }
  const submitSource = typeof options?.submitSource === 'string'
    ? options.submitSource.trim()
    : '';
  if (submitSource) {
    headers['X-Client-Submit-Source'] = submitSource;
  }
  if (Object.keys(headers).length === 0) return {};
  return { headers };
}

// Tasks API
export const tasksAPI = {
  list: (params) => apiClient.get('/tasks', { params }),
  sync: (params) => apiClient.get('/tasks/sync', { params }),
  get: (id) => apiClient.get(`/tasks/${id}`),
  create: (data, options = {}) => apiClient.post('/tasks', data, withTaskMutationHeaders(options)),
  update: (id, data, options = {}) => apiClient.put(`/tasks/${id}`, data, withTaskMutationHeaders(options)),
  delete: (id, options = {}) => apiClient.delete(`/tasks/${id}`, withTaskMutationHeaders(options)),
  updateStatus: (id, dataOrStatus, options = {}) => {
    const payload =
      typeof dataOrStatus === 'string'
        ? { status: dataOrStatus }
        : dataOrStatus;
    return apiClient.patch(`/tasks/${id}/status`, payload, withTaskMutationHeaders(options));
  },
  updateSchedule: (id, data, options = {}) => apiClient.patch(`/tasks/${id}/schedule`, data, withTaskMutationHeaders(options)),
  getInstances: (id, params) => apiClient.get(`/tasks/${id}/instances`, { params }),
  listActivities: (id, params) => apiClient.get(`/tasks/${id}/activities`, { params }),
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

export const caldavAPI = {
  discover: (data) => apiClient.post('/caldav/discover', data),
  listSources: () => apiClient.get('/caldav/sources'),
  createSource: (data) => apiClient.post('/caldav/sources', data),
  updateSource: (id, data) => apiClient.put(`/caldav/sources/${id}`, data),
  deleteSource: (id) => apiClient.delete(`/caldav/sources/${id}`),
  syncSource: (id) => apiClient.post(`/caldav/sources/${id}/sync`),
  listTasks: (params) => apiClient.get('/caldav/tasks', { params }),
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
