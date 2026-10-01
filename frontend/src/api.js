import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartlor_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) {
    localStorage.removeItem('smartlor_token');
    localStorage.removeItem('smartlor_user');
    if (window.location.pathname !== '/login') window.location.href = '/login';
  }
  return Promise.reject(error);
});

export default api;
