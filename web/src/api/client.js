import axios from 'axios';

// --- Platform-agnostic token storage ---
// In Tauri, inject a Keychain-backed implementation via window.__tokenStore before the app boots:
//   window.__tokenStore = { get, set, remove }
const defaultTokenStore = {
  get: () => localStorage.getItem('token'),
  set: (token) => localStorage.setItem('token', token),
  remove: () => localStorage.removeItem('token'),
};

export function getTokenStore() {
  if (typeof window !== 'undefined' && window.__tokenStore) {
    return window.__tokenStore;
  }
  return defaultTokenStore;
}

export function getToken() {
  return getTokenStore().get();
}

// In Tauri the WebView origin is tauri://localhost, so relative '/api' won't reach the server.
// Set VITE_API_BASE_URL at build time (e.g. https://todo.marlon.life/api) to override.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getTokenStore().get();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Token refresh state ---
let isRefreshing = false;
let refreshQueue = [];

function resolveRefreshQueue(token) {
  refreshQueue.forEach(({ resolve }) => resolve(token));
  refreshQueue = [];
}

function rejectRefreshQueue(err) {
  refreshQueue.forEach(({ reject }) => reject(err));
  refreshQueue = [];
}

function clearAuthAndRedirect() {
  const store = getTokenStore();
  store.remove();
  localStorage.removeItem('user');
  if (typeof window !== 'undefined') {
    if ('__TAURI_INTERNALS__' in window) {
      window.location.hash = '#/login';
      return;
    }
    window.location.href = '/login';
  }
}

async function attemptTokenRefresh() {
  const store = getTokenStore();
  const currentToken = store.get();
  if (!currentToken) throw new Error('no token');
  // Use raw axios to avoid triggering our own interceptors
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
  const res = await axios.post(`${base}/auth/refresh`, null, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${currentToken}`,
    },
  });
  const newToken = res.data?.token;
  if (!newToken) throw new Error('no token in refresh response');
  store.set(newToken);
  return newToken;
}

function isTauriCrossOriginAPI() {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return false;
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
  try {
    const resolved = new URL(base, window.location.origin);
    return resolved.origin !== window.location.origin;
  } catch {
    return false;
  }
}

function removeTaskMutationHeaders(config) {
  if (!config?.headers) return;
  ['If-Match', 'X-Client-Op-Id', 'X-Client-Submitted-At', 'X-Client-Submit-Source'].forEach((key) => {
    delete config.headers[key];
    delete config.headers[key.toLowerCase()];
  });
}

function shouldRetryWithoutTaskMutationHeaders(error) {
  const config = error?.config;
  if (!config?.__todoTaskMutationHeaders || config._retriedWithoutTaskMutationHeaders) return false;
  if (error?.response) return false;
  return isTauriCrossOriginAPI();
}

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (shouldRetryWithoutTaskMutationHeaders(error)) {
      originalRequest._retriedWithoutTaskMutationHeaders = true;
      removeTaskMutationHeaders(originalRequest);
      return apiClient(originalRequest);
    }
    if (error.response?.status === 401 && !originalRequest._retried) {
      originalRequest._retried = true;

      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      isRefreshing = true;
      try {
        const newToken = await attemptTokenRefresh();
        resolveRefreshQueue(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        rejectRefreshQueue(error);
        clearAuthAndRedirect();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
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
  updatePassword: (data) => apiClient.patch('/auth/password', data),
  reconcileReminders: () => apiClient.post('/auth/reconcile-reminders'),
};

export const aiConfigAPI = {
  get: () => apiClient.get('/ai/config'),
  save: (data) => apiClient.put('/ai/config', data),
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
  const clientOpID = typeof options?.clientOpID === 'string'
    ? options.clientOpID.trim()
    : '';
  if (clientOpID) {
    headers['X-Client-Op-Id'] = clientOpID;
  }
  if (Object.keys(headers).length === 0) return {};
  return { headers, __todoTaskMutationHeaders: true };
}

// Tasks API
export const tasksAPI = {
  list: (params) => apiClient.get('/tasks', { params }),
  sync: (params) => apiClient.get('/tasks/sync', { params }),
  listOccurrences: (params) => apiClient.get('/tasks/occurrences', { params }),
  listNextOccurrences: (params) => apiClient.get('/tasks/next-occurrences', { params }),
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
