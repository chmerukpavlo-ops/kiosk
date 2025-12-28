import { useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';

interface NotificationSettingsProps {
  onClose: () => void;
}

export function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const { supported, permission, requestPermission } = useNotifications();
  const [settings, setSettings] = useState({
    sales: true,
    schedule: true,
    sync: true,
    lowStock: false,
    dailyGoal: false,
  });

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load notification settings:', e);
      }
    }
  }, []);

  const handleToggle = (key: keyof typeof settings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
  };

  const handleRequestPermission = async () => {
    await requestPermission();
  };

  if (!supported) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
          <h2 className="text-xl font-bold mb-4 dark:text-gray-100">Налаштування сповіщень</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Ваш браузер не підтримує сповіщення.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Закрити
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-gray-100">Налаштування сповіщень</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {permission !== 'granted' && (
          <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
              Для отримання сповіщень потрібен дозвіл браузера.
            </p>
            <button
              onClick={handleRequestPermission}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium"
            >
              Дозволити сповіщення
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Нові продажі</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Сповіщення про успішні продажі
              </p>
            </div>
            <button
              onClick={() => handleToggle('sales')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.sales ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.sales ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Зміни в графіку</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Сповіщення про зміни робочого графіку
              </p>
            </div>
            <button
              onClick={() => handleToggle('schedule')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.schedule ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.schedule ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Синхронізація</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Сповіщення про завершення синхронізації
              </p>
            </div>
            <button
              onClick={() => handleToggle('sync')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.sync ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.sync ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Мало товару</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Сповіщення про низькі запаси
              </p>
            </div>
            <button
              onClick={() => handleToggle('lowStock')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.lowStock ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.lowStock ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Щоденна ціль</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Нагадування про прогрес досягнення цілі
              </p>
            </div>
            <button
              onClick={() => handleToggle('dailyGoal')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.dailyGoal ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.dailyGoal ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium"
          >
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}

