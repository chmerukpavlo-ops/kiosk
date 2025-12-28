import { useEffect, useRef } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from './useNotifications';
import { format } from 'date-fns';

interface ScheduleEntry {
  id: number;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  status: string;
}

export function useScheduleNotifications() {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const previousScheduleRef = useRef<Map<string, ScheduleEntry>>(new Map());

  useEffect(() => {
    if (!user?.id) return;

    const checkScheduleChanges = async () => {
      try {
        // Get current schedule for next 7 days
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        
        const response = await api.get('/schedule', {
          params: {
            startDate: format(new Date(), 'yyyy-MM-dd'),
            endDate: format(endDate, 'yyyy-MM-dd'),
          },
        });

        const currentSchedule = response.data as ScheduleEntry[];
        const currentScheduleMap = new Map(
          currentSchedule.map((entry) => [`${entry.date}_${entry.id}`, entry])
        );

        // Compare with previous schedule
        const previousSchedule = previousScheduleRef.current;

        for (const [key, currentEntry] of currentScheduleMap.entries()) {
          const previousEntry = previousSchedule.get(key);

          // New entry or changed entry
          if (!previousEntry) {
            // New schedule entry
            if (currentEntry.shift_start && currentEntry.shift_end) {
              await notify.scheduleChange(
                format(new Date(currentEntry.date), 'd MMM yyyy'),
                currentEntry.shift_start.substring(0, 5),
                currentEntry.shift_end.substring(0, 5)
              );
            }
          } else if (
            previousEntry.shift_start !== currentEntry.shift_start ||
            previousEntry.shift_end !== currentEntry.shift_end ||
            previousEntry.status !== currentEntry.status
          ) {
            // Schedule changed
            if (currentEntry.shift_start && currentEntry.shift_end) {
              await notify.scheduleChange(
                format(new Date(currentEntry.date), 'd MMM yyyy'),
                currentEntry.shift_start.substring(0, 5),
                currentEntry.shift_end.substring(0, 5)
              );
            }
          }
        }

        // Update previous schedule
        previousScheduleRef.current = currentScheduleMap;
      } catch (error) {
        console.error('Error checking schedule changes:', error);
      }
    };

    // Check immediately
    checkScheduleChanges();

    // Check every 5 minutes
    const interval = setInterval(checkScheduleChanges, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user?.id, notify]);
}

