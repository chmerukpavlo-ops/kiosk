import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { toast } from '../../components/Toast';

interface TelegramUser {
  id: number;
  full_name: string;
  telegram_chat_id: string | null;
  sales_count: number;
}

export function TelegramSettings() {
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState('');
  const [testChatId, setTestChatId] = useState('');

  useEffect(() => {
    loadSettings();
    loadMyChatId();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/telegram/settings');
      setUsers(response.data || []);
    } catch (error: any) {
      console.error('Failed to load Telegram settings:', error);
      toast.error('Помилка завантаження налаштувань');
    } finally {
      setLoading(false);
    }
  };

  const loadMyChatId = async () => {
    try {
      const response = await api.get('/telegram/chat-id');
      if (response.data.chat_id) {
        setChatId(response.data.chat_id);
      }
    } catch (error) {
      console.error('Failed to load chat ID:', error);
    }
  };

  const handleLink = async () => {
    if (!chatId.trim()) {
      toast.error('Введіть Chat ID');
      return;
    }

    try {
      await api.post('/telegram/link', { chat_id: chatId.trim() });
      toast.success('Telegram успішно підключено!');
      loadMyChatId();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка підключення Telegram');
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Ви впевнені, що хочете відключити Telegram?')) return;

    try {
      await api.post('/telegram/unlink');
      toast.success('Telegram відключено');
      setChatId('');
      loadMyChatId();
    } catch (error: any) {
      toast.error('Помилка відключення Telegram');
    }
  };

  const handleTest = async () => {
    if (!testChatId.trim()) {
      toast.error('Введіть Chat ID для тесту');
      return;
    }

    try {
      await api.post('/telegram/test', { chat_id: testChatId.trim() });
      toast.success('Тестове повідомлення надіслано!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Помилка надсилання тестового повідомлення');
    }
  };

  if (loading) {
    return <div className="text-center py-12">Завантаження...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Налаштування Telegram</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          Підключіть Telegram для отримання сповіщень про продажі та важливі події
        </p>
      </div>

      {/* How to get Chat ID */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h2 className="text-lg font-semibold mb-3">📱 Як отримати Chat ID?</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>Відкрийте Telegram та знайдіть бота <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">@userinfobot</code></li>
          <li>Надішліть боту команду <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">/start</code></li>
          <li>Скопіюйте ваш <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded">Id</code> (число)</li>
          <li>Вставте його в поле нижче</li>
        </ol>
      </div>

      {/* Link Telegram */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Підключення Telegram</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Chat ID</label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="Введіть ваш Telegram Chat ID"
              className="input"
            />
            {chatId && (
              <p className="text-xs text-gray-500 mt-1">
                Поточний Chat ID: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{chatId}</code>
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLink}
              className="btn btn-primary"
            >
              Підключити
            </button>
            {chatId && (
              <button
                onClick={handleUnlink}
                className="btn btn-secondary"
              >
                Відключити
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Test Notification */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Тестове повідомлення</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Chat ID для тесту</label>
            <input
              type="text"
              value={testChatId}
              onChange={(e) => setTestChatId(e.target.value)}
              placeholder="Введіть Chat ID"
              className="input"
            />
          </div>
          <button
            onClick={handleTest}
            className="btn btn-secondary"
          >
            Надіслати тестове повідомлення
          </button>
        </div>
      </div>

      {/* Users List */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Користувачі з підключеним Telegram</h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Користувач</th>
                <th>Chat ID</th>
                <th>Продажів сьогодні</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter(u => u.telegram_chat_id)
                .map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium">{user.full_name}</td>
                    <td>
                      <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">
                        {user.telegram_chat_id}
                      </code>
                    </td>
                    <td>{user.sales_count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {users.filter(u => u.telegram_chat_id).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Немає користувачів з підключеним Telegram
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

