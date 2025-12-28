// Offline synchronization utility
import api from './api';
import { getPendingSales, removePendingSale, updateRetryCount } from './offlineStorage';
import { toast } from '../components/Toast';
import { showNotification, notifications } from './notifications';

const MAX_RETRY_COUNT = 3;
const SYNC_INTERVAL = 5000; // Sync every 5 seconds when online

let syncInterval: number | null = null;
let isSyncing = false;

// Check if online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Sync pending sales to server
export async function syncPendingSales(): Promise<{ success: number; failed: number }> {
  if (isSyncing) {
    return { success: 0, failed: 0 };
  }

  if (!isOnline()) {
    return { success: 0, failed: 0 };
  }

  isSyncing = true;
  let successCount = 0;
  let failedCount = 0;

  try {
    const pendingSales = await getPendingSales();

    if (pendingSales.length === 0) {
      isSyncing = false;
      return { success: 0, failed: 0 };
    }

    console.log(`🔄 Syncing ${pendingSales.length} pending sales...`);

    // Sync sales in batches to avoid overwhelming the server
    for (const sale of pendingSales) {
      try {
        // Skip if retry count exceeded
        if (sale.retryCount >= MAX_RETRY_COUNT) {
          console.warn(`⚠️ Skipping sale ${sale.id} - max retries exceeded`);
          failedCount++;
          continue;
        }

        // Try to sync the sale
        await api.post('/sales', sale.data);
        
        // Remove from offline storage on success
        await removePendingSale(sale.id);
        successCount++;
        console.log(`✅ Synced sale: ${sale.id}`);
      } catch (error: any) {
        console.error(`❌ Failed to sync sale ${sale.id}:`, error);
        
        // Increment retry count
        await updateRetryCount(sale.id, sale.retryCount + 1);
        failedCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`Синхронізовано ${successCount} продажів`);
      // Show notification about sync completion
      await showNotification(notifications.syncComplete(successCount));
    }

    if (failedCount > 0 && successCount === 0) {
      toast.error(`Не вдалося синхронізувати ${failedCount} продажів`);
    }
  } catch (error) {
    console.error('Error during sync:', error);
  } finally {
    isSyncing = false;
  }

  return { success: successCount, failed: failedCount };
}

// Start automatic sync
export function startAutoSync(): void {
  if (syncInterval) {
    return; // Already running
  }

  // Sync immediately if online
  if (isOnline()) {
    syncPendingSales();
  }

  // Set up interval for periodic sync
  syncInterval = window.setInterval(() => {
    if (isOnline() && !isSyncing) {
      syncPendingSales();
    }
  }, SYNC_INTERVAL);

  // Listen for online event
  window.addEventListener('online', () => {
    console.log('🌐 Connection restored, syncing...');
    syncPendingSales();
  });

  console.log('🔄 Auto-sync started');
}

// Stop automatic sync
export function stopAutoSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('⏸️ Auto-sync stopped');
  }
}

// Manual sync trigger
export async function manualSync(): Promise<void> {
  if (!isOnline()) {
    toast.error('Немає інтернет-з\'єднання');
    return;
  }

  toast.info('Синхронізація...');
  await syncPendingSales();
}

