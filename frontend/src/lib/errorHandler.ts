/**
 * Utility functions for handling and formatting API errors
 */

export interface ApiError {
  message?: string;
  error?: string;
  status?: number;
  code?: string;
}

/**
 * Formats API error into user-friendly message
 */
export function formatErrorMessage(error: any): string {
  // Network errors
  if (!error.response) {
    if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
      return 'Не вдалося підключитися до сервера. Перевірте, чи запущений backend.';
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Помилка мережі. Перевірте інтернет-з\'єднання.';
    }
    return 'Помилка з\'єднання. Спробуйте пізніше.';
  }

  const status = error.response?.status;
  const data = error.response?.data;

  // HTTP status-based messages
  switch (status) {
    case 400:
      return data?.error || 'Невірні дані. Перевірте введену інформацію.';
    case 401:
      return 'Не авторизовано. Будь ласка, увійдіть знову.';
    case 403:
      return 'Доступ заборонено. У вас немає прав для цієї дії.';
    case 404:
      return data?.error || 'Запитуваний ресурс не знайдено.';
    case 409:
      return data?.error || 'Конфлікт даних. Можливо, запис вже існує.';
    case 422:
      return data?.error || 'Помилка валідації. Перевірте введені дані.';
    case 500:
      return 'Помилка сервера. Спробуйте пізніше або зверніться до адміністратора.';
    case 503:
      return 'Сервіс тимчасово недоступний. Спробуйте пізніше.';
    default:
      return data?.error || data?.message || `Помилка (${status || 'невідома'}). Спробуйте пізніше.`;
  }
}

/**
 * Gets detailed error information for debugging
 */
export function getErrorDetails(error: any): string {
  if (!error.response) {
    return error.message || 'Невідома помилка мережі';
  }

  const data = error.response?.data;
  if (data?.error) {
    return data.error;
  }
  if (data?.message) {
    return data.message;
  }

  return `HTTP ${error.response?.status}: ${error.message || 'Невідома помилка'}`;
}

