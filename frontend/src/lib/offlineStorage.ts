// Offline storage utility for PWA
// Uses IndexedDB for reliable offline storage

const DB_NAME = 'kiosk_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

interface PendingSale {
  id: string; // UUID для унікальності
  data: {
    product_id: number;
    quantity: number;
    customer_id?: number;
    payment_method?: 'cash' | 'card';
  };
  timestamp: number;
  retryCount: number;
}

let db: IDBDatabase | null = null;

// Initialize IndexedDB
export async function initOfflineStorage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('✅ IndexedDB initialized');
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('✅ Created object store:', STORE_NAME);
      }
    };
  });
}

// Save sale to offline storage
export async function saveSaleOffline(sale: PendingSale['data']): Promise<string> {
  if (!db) {
    await initOfflineStorage();
  }

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const pendingSale: PendingSale = {
      id: `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: sale,
      timestamp: Date.now(),
      retryCount: 0,
    };

    const request = store.add(pendingSale);

    request.onsuccess = () => {
      console.log('💾 Sale saved offline:', pendingSale.id);
      resolve(pendingSale.id);
    };

    request.onerror = () => {
      console.error('Failed to save sale offline:', request.error);
      reject(request.error);
    };
  });
}

// Get all pending sales
export async function getPendingSales(): Promise<PendingSale[]> {
  if (!db) {
    await initOfflineStorage();
  }

  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }

    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Remove sale from offline storage after successful sync
export async function removePendingSale(id: string): Promise<void> {
  if (!db) {
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      console.log('✅ Removed pending sale:', id);
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Update retry count for failed sync
export async function updateRetryCount(id: string, retryCount: number): Promise<void> {
  if (!db) {
    return;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const sale = getRequest.result;
      if (sale) {
        sale.retryCount = retryCount;
        const putRequest = store.put(sale);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Get count of pending sales
export async function getPendingSalesCount(): Promise<number> {
  if (!db) {
    await initOfflineStorage();
  }
  const sales = await getPendingSales();
  return sales.length;
}

