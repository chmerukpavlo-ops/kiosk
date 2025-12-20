import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Детальна обробка помилок
      if (err.isTimeout) {
        setError(err.message || 'Таймаут запиту. Сервер не відповідає вчасно. Спробуйте ще раз.');
      } else if (err.isNetworkError || err.code === 'ECONNREFUSED' || err.message?.includes('Network Error')) {
        setError(err.message || 'Не вдалося підключитися до сервера. Перевірте, чи запущений backend.');
      } else if (err.response?.status === 401) {
        setError(err.response?.data?.error || 'Невірний логін або пароль');
      } else if (err.response?.status === 500) {
        setError('Помилка сервера. Перевірте логи backend');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError(err.message || 'Помилка входу. Перевірте консоль браузера для деталей.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4 py-8">
      <div className="card w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Вхід в систему</h1>
          <p className="text-sm sm:text-base text-gray-600">Система обліку кіосків</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Логін
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 text-base touch-manipulation"
          >
            {loading ? 'Вхід...' : 'Увійти'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Тестові дані:</p>
          <p className="mt-1">Логін: admin / Пароль: admin123</p>
        </div>
      </div>
    </div>
  );
}

