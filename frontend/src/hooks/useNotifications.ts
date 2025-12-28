import { useEffect, useState } from 'react';
import {
  requestNotificationPermission,
  isNotificationSupported,
  showNotification,
  setupNotificationClickHandler,
  notifications,
} from '../lib/notifications';

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isNotificationSupported());
    
    if (isNotificationSupported()) {
      setPermission(Notification.permission);
      setupNotificationClickHandler();
    }
  }, []);

  const requestPermission = async () => {
    const newPermission = await requestNotificationPermission();
    setPermission(newPermission);
    return newPermission;
  };

  const notify = {
    newSale: async (productName: string, quantity: number, revenue: number) => {
      await showNotification(notifications.newSale(productName, quantity, revenue));
    },
    scheduleChange: async (date: string, shiftStart: string, shiftEnd: string) => {
      await showNotification(notifications.scheduleChange(date, shiftStart, shiftEnd));
    },
    lowStock: async (productName: string, quantity: number) => {
      await showNotification(notifications.lowStock(productName, quantity));
    },
    syncComplete: async (count: number) => {
      await showNotification(notifications.syncComplete(count));
    },
    dailyGoalReminder: async (current: number, target: number) => {
      await showNotification(notifications.dailyGoalReminder(current, target));
    },
  };

  return {
    supported,
    permission,
    requestPermission,
    notify,
  };
}

