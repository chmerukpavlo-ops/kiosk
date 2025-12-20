import { Request, Response, NextFunction } from 'express';
import { query } from '../db/init.js';
import { AuthRequest } from './auth.js';

interface LogActionOptions {
  actionType: string;
  entityType: string;
  entityId?: number;
  description?: string;
  changes?: Record<string, any>;
}

/**
 * Middleware для логування дій адміністратора
 */
export function logAction(options: LogActionOptions) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Логуємо тільки для адміністраторів
    if (req.user?.role !== 'admin') {
      return next();
    }

    // Отримуємо IP адресу та User-Agent
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    try {
      await query(
        `INSERT INTO action_logs (user_id, action_type, entity_type, entity_id, description, changes, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          req.user.id,
          options.actionType,
          options.entityType,
          options.entityId || null,
          options.description || null,
          options.changes ? JSON.stringify(options.changes) : null,
          ipAddress,
          userAgent,
        ]
      );
    } catch (error) {
      // Не блокуємо запит якщо логування не вдалося
      console.error('Failed to log action:', error);
    }

    next();
  };
}

/**
 * Функція для логування дій після виконання операції
 */
export async function logActionAfter(
  userId: number | undefined,
  options: LogActionOptions & { ipAddress?: string; userAgent?: string }
) {
  if (!userId) return;

  try {
    await query(
      `INSERT INTO action_logs (user_id, action_type, entity_type, entity_id, description, changes, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        options.actionType,
        options.entityType,
        options.entityId || null,
        options.description || null,
        options.changes ? JSON.stringify(options.changes) : null,
        options.ipAddress || 'unknown',
        options.userAgent || 'unknown',
      ]
    );
  } catch (error) {
    console.error('Failed to log action:', error);
  }
}

