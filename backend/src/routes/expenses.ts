import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all expenses (with filters)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { startDate, endDate, category, kiosk_id } = req.query;

    let sql = `
      SELECT e.*, 
             k.name as kiosk_name,
             u.full_name as created_by_name
      FROM expenses e
      LEFT JOIN kiosks k ON e.kiosk_id = k.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (startDate) {
      sql += ` AND e.date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      sql += ` AND e.date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    if (category) {
      sql += ` AND e.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (kiosk_id) {
      sql += ` AND e.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    sql += ' ORDER BY e.date DESC, e.created_at DESC LIMIT 1000';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get expenses statistics
router.get('/stats', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { period = 'day', kiosk_id, category } = req.query;

    let dateFilter = '';
    if (period === 'day') {
      dateFilter = "date = CURRENT_DATE";
    } else if (period === 'week') {
      dateFilter = "date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "date >= CURRENT_DATE - INTERVAL '30 days'";
    }

    let sql = `SELECT 
      COUNT(*) as total_expenses,
      SUM(amount) as total_amount,
      category,
      SUM(amount) as category_amount
    FROM expenses WHERE ${dateFilter}`;

    const params: any[] = [];
    let paramCount = 1;

    if (kiosk_id) {
      sql += ` AND kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (category) {
      sql += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    sql += ' GROUP BY category';

    const result = await query(sql, params);
    
    // Загальна сума
    const totalResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM expenses WHERE ${dateFilter}${kiosk_id ? ` AND kiosk_id = $1` : ''}${category ? ` AND category = $${kiosk_id ? 2 : 1}` : ''}`,
      kiosk_id || category ? [kiosk_id, category].filter(Boolean) : []
    );

    res.json({
      total: parseFloat(totalResult.rows[0]?.total || '0'),
      by_category: result.rows,
    });
  } catch (error) {
    console.error('Get expenses stats error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create expense
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id, category, description, amount, date } = req.body;
    const created_by = req.user!.id;

    if (!category || !amount || !date) {
      return res.status(400).json({ error: 'Категорія, сума та дата обов\'язкові' });
    }

    if (!['rent', 'purchase', 'other'].includes(category)) {
      return res.status(400).json({ error: 'Невірна категорія' });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Сума повинна бути більше 0' });
    }

    const result = await query(
      `INSERT INTO expenses (kiosk_id, category, description, amount, date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [kiosk_id || null, category, description || null, parseFloat(amount), date, created_by]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update expense
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id, category, description, amount, date } = req.body;

    if (category && !['rent', 'purchase', 'other'].includes(category)) {
      return res.status(400).json({ error: 'Невірна категорія' });
    }

    if (amount && parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Сума повинна бути більше 0' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (kiosk_id !== undefined) {
      updates.push(`kiosk_id = $${paramCount}`);
      params.push(kiosk_id || null);
      paramCount++;
    }

    if (category) {
      updates.push(`category = $${paramCount}`);
      params.push(category);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description || null);
      paramCount++;
    }

    if (amount) {
      updates.push(`amount = $${paramCount}`);
      params.push(parseFloat(amount));
      paramCount++;
    }

    if (date) {
      updates.push(`date = $${paramCount}`);
      params.push(date);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Немає даних для оновлення' });
    }

    params.push(req.params.id);
    const sql = `UPDATE expenses SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Витрата не знайдена' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete expense
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Витрата не знайдена' });
    }

    res.json({ message: 'Витрата видалена' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

