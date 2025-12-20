import { query } from '../db/init.js';

interface Reminder {
  id: number;
  type: 'low_stock' | 'overdue_expense' | 'upcoming_expense' | 'schedule' | 'inventory';
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  entity_id?: number;
  entity_type?: string;
  due_date?: string;
  created_at: string;
}

/**
 * Отримати всі активні нагадування
 */
export async function getActiveReminders(): Promise<Reminder[]> {
  const reminders: Reminder[] = [];

  try {
    // Низькі залишки
    const lowStockResult = await query(`
      SELECT 
        sa.id,
        p.name as product_name,
        p.quantity,
        sa.threshold,
        k.name as kiosk_name
      FROM stock_alerts sa
      JOIN products p ON sa.product_id = p.id
      LEFT JOIN kiosks k ON sa.kiosk_id = k.id
      WHERE sa.status = 'active'
      ORDER BY sa.triggered_at DESC
      LIMIT 20
    `);

    lowStockResult.rows.forEach((row) => {
      reminders.push({
        id: row.id,
        type: 'low_stock',
        title: 'Низький залишок товару',
        message: `${row.product_name} (${row.kiosk_name || 'Невідомий ларьок'}): залишилось ${row.quantity} шт. (поріг: ${row.threshold})`,
        severity: row.quantity === 0 ? 'high' : 'medium',
        entity_id: row.id,
        entity_type: 'product',
        created_at: new Date().toISOString(),
      });
    });

    // Прострочені витрати
    const overdueExpensesResult = await query(`
      SELECT 
        id,
        description,
        amount,
        planned_for,
        kiosk_id
      FROM expenses
      WHERE status = 'planned'
        AND planned_for < CURRENT_DATE
      ORDER BY planned_for ASC
      LIMIT 20
    `);

    overdueExpensesResult.rows.forEach((row) => {
      const daysOverdue = Math.floor(
        (new Date().getTime() - new Date(row.planned_for).getTime()) / (1000 * 60 * 60 * 24)
      );
      reminders.push({
        id: row.id,
        type: 'overdue_expense',
        title: 'Прострочена витрата',
        message: `${row.description || 'Без опису'}: ${parseFloat(row.amount).toFixed(2)} ₴ (${daysOverdue} дн. прострочено)`,
        severity: daysOverdue > 7 ? 'high' : daysOverdue > 3 ? 'medium' : 'low',
        entity_id: row.id,
        entity_type: 'expense',
        due_date: row.planned_for,
        created_at: new Date().toISOString(),
      });
    });

    // Майбутні витрати (наступні 3 дні)
    const upcomingExpensesResult = await query(`
      SELECT 
        id,
        description,
        amount,
        planned_for,
        kiosk_id
      FROM expenses
      WHERE status = 'planned'
        AND planned_for >= CURRENT_DATE
        AND planned_for <= CURRENT_DATE + INTERVAL '3 days'
      ORDER BY planned_for ASC
      LIMIT 20
    `);

    upcomingExpensesResult.rows.forEach((row) => {
      const daysUntil = Math.floor(
        (new Date(row.planned_for).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      reminders.push({
        id: row.id,
        type: 'upcoming_expense',
        title: 'Майбутня витрата',
        message: `${row.description || 'Без опису'}: ${parseFloat(row.amount).toFixed(2)} ₴ (через ${daysUntil} дн.)`,
        severity: daysUntil === 0 ? 'high' : 'medium',
        entity_id: row.id,
        entity_type: 'expense',
        due_date: row.planned_for,
        created_at: new Date().toISOString(),
      });
    });

    // Графік роботи (незаповнені дні на поточному тижні)
    const scheduleResult = await query(`
      SELECT 
        k.id as kiosk_id,
        k.name as kiosk_name,
        COUNT(DISTINCT s.date) as filled_days,
        7 as total_days
      FROM kiosks k
      LEFT JOIN schedule s ON s.kiosk_id = k.id
        AND s.date >= DATE_TRUNC('week', CURRENT_DATE)
        AND s.date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
      GROUP BY k.id, k.name
      HAVING COUNT(DISTINCT s.date) < 7
      LIMIT 10
    `);

    scheduleResult.rows.forEach((row) => {
      const missingDays = row.total_days - row.filled_days;
      reminders.push({
        id: row.kiosk_id,
        type: 'schedule',
        title: 'Неповний графік роботи',
        message: `${row.kiosk_name}: заповнено ${row.filled_days} з 7 днів (відсутні ${missingDays} дні)`,
        severity: missingDays > 3 ? 'high' : 'medium',
        entity_id: row.kiosk_id,
        entity_type: 'schedule',
        created_at: new Date().toISOString(),
      });
    });

    // Інвентаризація (чернетки старіші за 3 дні)
    const inventoryResult = await query(`
      SELECT 
        i.id,
        i.kiosk_id,
        k.name as kiosk_name,
        i.created_at,
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - i.created_at) as days_old
      FROM inventory i
      LEFT JOIN kiosks k ON i.kiosk_id = k.id
      WHERE i.status = 'draft'
        AND i.created_at < CURRENT_TIMESTAMP - INTERVAL '3 days'
      ORDER BY i.created_at ASC
      LIMIT 10
    `);

    inventoryResult.rows.forEach((row) => {
      reminders.push({
        id: row.id,
        type: 'inventory',
        title: 'Незавершена інвентаризація',
        message: `${row.kiosk_name || 'Невідомий ларьок'}: чернетка створена ${Math.floor(row.days_old)} дн. тому`,
        severity: row.days_old > 7 ? 'high' : 'medium',
        entity_id: row.id,
        entity_type: 'inventory',
        created_at: row.created_at,
      });
    });
  } catch (error) {
    console.error('Get reminders error:', error);
  }

  return reminders.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

/**
 * Відмітити нагадування як прочитане (для майбутнього використання)
 */
export async function markReminderRead(reminderId: number, reminderType: string): Promise<void> {
  // Можна додати таблицю read_reminders для відстеження прочитаних нагадувань
  // Поки що просто логуємо
  console.log(`Reminder marked as read: ${reminderType}:${reminderId}`);
}

