// Push notifications utility for PWA

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  actions?: NotificationAction[];
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

// Check if notification type is enabled
function isNotificationEnabled(type: string): boolean {
  try {
    const settings = localStorage.getItem('notificationSettings');
    if (!settings) return true; // Default enabled
    
    const parsed = JSON.parse(settings);
    return parsed[type] !== false;
  } catch {
    return true;
  }
}

// Show a notification
export async function showNotification(options: NotificationOptions): Promise<void> {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return;
  }

  // Check if this notification type is enabled
  const notificationType = options.data?.type || 'default';
  if (!isNotificationEnabled(notificationType)) {
    return; // Notification type is disabled
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  // Try to use service worker for better PWA experience
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(options.title, {
        body: options.body,
        icon: options.icon || '/icon.svg',
        badge: options.badge || '/icon.svg',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        actions: options.actions || [],
        vibrate: [200, 100, 200],
        timestamp: Date.now(),
      });
      return;
    } catch (error) {
      console.warn('Service worker notification failed, falling back to regular notification:', error);
    }
  }

  // Fallback to regular notification
  new Notification(options.title, {
    body: options.body,
    icon: options.icon || '/icon.svg',
    tag: options.tag,
    data: options.data,
  });
}

// Notification templates
export const notifications = {
  // New sale notification
  newSale: (productName: string, quantity: number, revenue: number) => ({
    title: '💰 Новий продаж',
    body: `${productName} x${quantity} - ${revenue.toFixed(2)} ₴`,
    icon: '/icon.svg',
    tag: 'new-sale',
    data: { type: 'sale' },
  }),

  // Schedule change notification
  scheduleChange: (date: string, shiftStart: string, shiftEnd: string) => ({
    title: '📅 Зміна в графіку',
    body: `${date}: ${shiftStart} - ${shiftEnd}`,
    icon: '/icon.svg',
    tag: 'schedule-change',
    data: { type: 'schedule', date },
    requireInteraction: true,
  }),

  // Low stock notification
  lowStock: (productName: string, quantity: number) => ({
    title: '⚠️ Мало товару',
    body: `${productName}: залишилось ${quantity} шт.`,
    icon: '/icon.svg',
    tag: 'low-stock',
    data: { type: 'stock' },
  }),

  // Sync complete notification
  syncComplete: (count: number) => ({
    title: '✅ Синхронізація завершена',
    body: `Синхронізовано ${count} продажів`,
    icon: '/icon.svg',
    tag: 'sync-complete',
    data: { type: 'sync' },
  }),

  // Daily goal reminder
  dailyGoalReminder: (current: number, target: number) => ({
    title: '🎯 Щоденна ціль',
    body: `Прогрес: ${current}/${target} продажів`,
    icon: '/icon.svg',
    tag: 'daily-goal',
    data: { type: 'goal' },
  }),
};

// Setup notification click handler
export function setupNotificationClickHandler(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'notificationclick') {
        const notificationData = event.data.notification;
        
        // Handle different notification types
        if (notificationData.data) {
          switch (notificationData.data.type) {
            case 'sale':
              // Focus window and navigate to sales
              window.focus();
              window.location.href = '/';
              break;
            case 'schedule':
              // Navigate to schedule
              window.focus();
              window.location.href = '/schedule';
              break;
            case 'stock':
              // Navigate to products
              window.focus();
              window.location.href = '/products';
              break;
            default:
              window.focus();
          }
        }
      }
    });
  }
}

