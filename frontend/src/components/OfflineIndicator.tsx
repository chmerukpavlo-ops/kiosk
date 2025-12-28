import { useEffect, useState } from 'react';
import { getPendingSalesCount } from '../lib/offlineStorage';
import { isOnline, manualSync } from '../lib/offlineSync';
import { toast } from './Toast';

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Check initial status
    setOnline(isOnline());

    // Listen for online/offline events
    const handleOnline = () => {
      setOnline(true);
      toast.success('Інтернет-з\'єднання відновлено');
    };

    const handleOffline = () => {
      setOnline(false);
      toast.info('Немає інтернет-з\'єднання. Дані зберігаються локально.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update pending count periodically
    const updatePendingCount = async () => {
      try {
        const count = await getPendingSalesCount();
        setPendingCount(count);
      } catch (error) {
        console.error('Failed to get pending count:', error);
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (online && pendingCount === 0) {
    return null; // Don't show indicator when everything is synced
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`rounded-lg shadow-lg p-3 cursor-pointer transition-all ${
          online
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center gap-2">
          {online ? (
            <>
              <span className="text-yellow-600 dark:text-yellow-400">⚠️</span>
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {pendingCount} продажів очікують синхронізації
              </span>
            </>
          ) : (
            <>
              <span className="text-red-600 dark:text-red-400">📴</span>
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                Офлайн режим
              </span>
              {pendingCount > 0 && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  ({pendingCount} очікують)
                </span>
              )}
            </>
          )}
        </div>

        {showDetails && (
          <div className="mt-2 pt-2 border-t border-yellow-300 dark:border-yellow-700">
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-2">
              {online
                ? 'Продажі збережені локально і будуть синхронізовані автоматично.'
                : 'Продажі зберігаються локально. Після відновлення інтернету вони синхронізуються автоматично.'}
            </p>
            {online && pendingCount > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  manualSync();
                }}
                className="w-full px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded font-medium transition-colors"
              >
                Синхронізувати зараз
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

