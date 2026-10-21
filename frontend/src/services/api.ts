import axios from 'axios';

const rawBackendUrl = (import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const BASE_URL = `${rawBackendUrl}/api/v1`;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 60000),
});

// Automatically attach Bearer token to all outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cognify:token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Intercept 401 responses globally — clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cognify:token');
      delete api.defaults.headers.common['Authorization'];
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);
