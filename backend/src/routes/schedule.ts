import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get schedule
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { date, employee_id, kiosk_id, startDate, endDate } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const userId = req.user?.id;

    let sql = `
      SELECT s.*, 
             u.full_name as employee_name,
             k.name as kiosk_name
      FROM schedule s
      LEFT JOIN users u ON s.employee_id = u.id
      LEFT JOIN kiosks k ON s.kiosk_id = k.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    // Sellers only see their schedule
    if (!isAdmin && userId) {
      sql += ` AND s.employee_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (employee_id) {
      sql += ` AND s.employee_id = $${paramCount}`;
      params.push(employee_id);
      paramCount++;
    }

    if (kiosk_id) {
      sql += ` AND s.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (date) {
      sql += ` AND s.date = $${paramCount}`;
      params.push(date);
      paramCount++;
    }

    if (startDate && endDate) {
      sql += ` AND s.date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    }

    sql += ' ORDER BY s.date DESC, s.shift_start';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create schedule entry (admin only)
router.post('/', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { employee_id, kiosk_id, date, shift_start, shift_end, status } = req.body;

    if (!employee_id || !kiosk_id || !date) {
      return res.status(400).json({ error: 'Продавець, ларьок та дата обов\'язкові' });
    }

    const result = await query(
      `INSERT INTO schedule (employee_id, kiosk_id, date, shift_start, shift_end, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [employee_id, kiosk_id, date, shift_start || null, shift_end || null, status || 'scheduled']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update schedule (admin or employee for status)
router.put('/:id', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { shift_start, shift_end, status } = req.body;
    const isAdmin = req.user?.role === 'admin';
    const userId = req.user?.id;

    // Get current schedule entry
    const currentResult = await query('SELECT * FROM schedule WHERE id = $1', [req.params.id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Запис не знайдено' });
    }

    const schedule = currentResult.rows[0];

    // Employees can only update their own status
    if (!isAdmin && schedule.employee_id !== userId) {
      return res.status(403).json({ error: 'Доступ заборонено' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (shift_start !== undefined && isAdmin) {
      updates.push(`shift_start = $${paramCount}`);
      params.push(shift_start);
      paramCount++;
    }

    if (shift_end !== undefined && isAdmin) {
      updates.push(`shift_end = $${paramCount}`);
      params.push(shift_end);
      paramCount++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Немає даних для оновлення' });
    }

    params.push(req.params.id);
    const sql = `UPDATE schedule SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await query(sql, params);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete schedule entry (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const result = await query('DELETE FROM schedule WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запис не знайдено' });
    }

    res.json({ message: 'Запис видалено' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

