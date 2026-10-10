import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('opportunityos_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for unified error formatting
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token on 401 if not on login page
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/signup')) {
        localStorage.removeItem('opportunityos_token');
        localStorage.removeItem('opportunityos_user');
        localStorage.removeItem('opportunityos_profile_complete');
        window.dispatchEvent(
          new CustomEvent('auth:expired', {
            detail: { redirect: currentPath + window.location.search },
          })
        );
      }
    }
    const appError = error.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: error.message || 'Something went wrong. Please check your connection.',
    };
    return Promise.reject(appError);
  }
);
