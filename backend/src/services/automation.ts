import { query } from '../db/init.js';
import { logActionAfter } from '../middleware/actionLogger.js';

/**
 * Автоматичне закриття змін (викликається cron job або вручну)
 */
export async function autoCloseShifts(): Promise<{ closed: number; errors: number }> {
  let closed = 0;
  let errors = 0;

  try {
    // Знаходимо всі активні зміни, які закінчились більше ніж 1 годину тому
    const activeShiftsResult = await query(`
      SELECT 
        s.id,
        s.employee_id,
        s.date,
        s.start_time,
        s.end_time,
        u.full_name as employee_name,
        k.name as kiosk_name
      FROM schedule s
      JOIN users u ON s.employee_id = u.id
      LEFT JOIN kiosks k ON s.kiosk_id = k.id
      WHERE s.status = 'active'
        AND s.date < CURRENT_DATE
        OR (s.date = CURRENT_DATE 
            AND s.end_time IS NOT NULL 
            AND (CURRENT_TIME - s.end_time::time) > INTERVAL '1 hour')
    `);

    for (const shift of activeShiftsResult.rows) {
      try {
        await query(
          `UPDATE schedule SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [shift.id]
        );

        // Логування (системний користувач)
        await logActionAfter(1, {
          actionType: 'auto_close_shift',
          entityType: 'schedule',
          entityId: shift.id,
          description: `Автоматично закрито зміну: ${shift.employee_name} (${shift.kiosk_name})`,
          changes: { status: 'completed' },
          ipAddress: 'system',
          userAgent: 'automation',
        });

        closed++;
      } catch (error) {
        console.error(`Failed to close shift ${shift.id}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Auto close shifts error:', error);
  }

  return { closed, errors };
}

/**
 * Автоматичне створення щоденних звітів
 */
export async function generateDailyReports(): Promise<{ created: number; errors: number }> {
  let created = 0;
  let errors = 0;

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Отримуємо статистику по кожному ларьку за вчора
    const kiosksResult = await query('SELECT id, name FROM kiosks');

    for (const kiosk of kiosksResult.rows) {
      try {
        // Статистика продажів
        const salesStats = await query(
          `SELECT 
            COUNT(*) as total_sales,
            SUM(price) as total_revenue,
            SUM(quantity) as total_quantity
          FROM sales
          WHERE kiosk_id = $1
            AND DATE(created_at) = $2`,
          [kiosk.id, yesterdayStr]
        );

        // Статистика витрат
        const expensesStats = await query(
          `SELECT 
            COUNT(*) as total_expenses,
            SUM(amount) as total_amount
          FROM expenses
          WHERE kiosk_id = $1
            AND date = $2
            AND COALESCE(status, 'paid') = 'paid'`,
          [kiosk.id, yesterdayStr]
        );

        const sales = salesStats.rows[0] || {};
        const expenses = expensesStats.rows[0] || {};

        // Можна зберегти звіт в окрему таблицю або просто логувати
        console.log(`Daily report for ${kiosk.name} (${yesterdayStr}):`, {
          sales: {
            count: parseInt(sales.total_sales || '0'),
            revenue: parseFloat(sales.total_revenue || '0'),
            quantity: parseInt(sales.total_quantity || '0'),
          },
          expenses: {
            count: parseInt(expenses.total_expenses || '0'),
            amount: parseFloat(expenses.total_amount || '0'),
          },
        });

        created++;
      } catch (error) {
        console.error(`Failed to generate report for kiosk ${kiosk.id}:`, error);
        errors++;
      }
    }
  } catch (error) {
    console.error('Generate daily reports error:', error);
  }

  return { created, errors };
}

/**
 * Автоматичне очищення старих логів (старіші за 90 днів)
 */
export async function cleanupOldLogs(): Promise<{ deleted: number }> {
  let deleted = 0;

  try {
    const result = await query(
      `DELETE FROM action_logs 
       WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'`
    );
    deleted = result.rowCount || 0;
    console.log(`Cleaned up ${deleted} old action logs`);
  } catch (error) {
    console.error('Cleanup old logs error:', error);
  }

  return { deleted };
}

