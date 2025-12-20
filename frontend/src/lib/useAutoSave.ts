import { useEffect, useRef } from 'react';

interface UseAutoSaveOptions {
  data: any;
  onSave: (data: any) => void | Promise<void>;
  delay?: number;
  storageKey?: string;
  enabled?: boolean;
}

/**
 * Хук для автозбереження форми
 */
export function useAutoSave({
  data,
  onSave,
  delay = 2000,
  storageKey,
  enabled = true,
}: UseAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) return;

    // Збереження в localStorage для відновлення при перезавантаженні
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    }

    // Перевірка чи дані змінилися
    const currentData = JSON.stringify(data);
    if (currentData === lastSavedRef.current) return;

    // Очищення попереднього таймауту
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Встановлення нового таймауту
    timeoutRef.current = setTimeout(async () => {
      try {
        await onSave(data);
        lastSavedRef.current = currentData;
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, onSave, delay, storageKey, enabled]);

  // Функція для відновлення даних з localStorage
  const restore = (): any | null => {
    if (!storageKey) return null;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to restore from localStorage:', error);
    }
    return null;
  };

  // Функція для очищення збережених даних
  const clear = () => {
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    lastSavedRef.current = '';
  };

  return { restore, clear };
}

