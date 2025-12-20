import axios from 'axios';

// Використовуємо VITE_API_URL для production (Vercel), інакше /api для локальної розробки
const apiBaseURL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : import.meta.env.DEV 
    ? '/api' 
    : (() => {
        console.error('⚠️ VITE_API_URL не встановлено! API запити не працюватимуть на production.');
        return '/api'; // Fallback, але не працюватиме
      })();

// Log API URL for debugging (always)
console.log('🌐 API Base URL:', apiBaseURL);

// Визначаємо timeout залежно від середовища
// Render free tier може "засинати" і перший запит може займати 30-60 секунд
const isProduction = !import.meta.env.DEV;
const timeout = isProduction ? 60000 : 10000; // 60 секунд для production, 10 для dev

const api = axios.create({
  baseURL: apiBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: timeout,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors and network errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.error('⏱️ Request timeout:', error.message);
      const timeoutError = new Error(
        isProduction 
          ? 'Сервер не відповідає. Якщо використовуєте Render free tier, перший запит може займати до 60 секунд. Спробуйте ще раз.'
          : 'Таймаут запиту. Перевірте, чи запущений backend на порту 3001.'
      );
      (timeoutError as any).isTimeout = true;
      return Promise.reject(timeoutError);
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      const networkError = new Error(
        error.code === 'ECONNREFUSED'
          ? 'Не вдалося підключитися до сервера. Перевірте, чи запущений backend.'
          : 'Помилка мережі. Перевірте підключення до інтернету.'
      );
      (networkError as any).isNetworkError = true;
      return Promise.reject(networkError);
    }

    // Handle auth errors
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default api;

