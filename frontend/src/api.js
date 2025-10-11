import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Auth APIs
export const authApi = {
  status: () => api.get('/auth/status'),
  login: (payload) => api.post('/auth/login', payload),
  logout: () => api.get('/auth/logout'),
  signup: (payload) => api.post('/auth/signup', payload),
  google: (code) => api.post('/auth/google', { code }),
};

export default api;