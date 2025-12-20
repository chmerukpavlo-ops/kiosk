import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all employees
router.get('/', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { search } = req.query;
    
    let sql = `SELECT u.id, u.username, u.full_name, u.role, u.kiosk_id, k.name as kiosk_name,
              (SELECT COUNT(*) FROM sales WHERE seller_id = u.id AND DATE(created_at) = CURRENT_DATE) as sales_today
       FROM users u
       LEFT JOIN kiosks k ON u.kiosk_id = k.id
       WHERE u.role = 'seller'`;
    
    const params: any[] = [];
    if (search) {
      sql += ` AND (u.full_name ILIKE $1 OR u.username ILIKE $1)`;
      params.push(`%${search}%`);
    }
    
    sql += ' ORDER BY u.full_name';
    
    const result = await query(sql, params.length > 0 ? params : undefined);
    res.json(result.rows);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get single employee with stats
router.get('/:id', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const userId = req.user?.id;

    // Sellers can only see their own stats
    if (!isAdmin && userId !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Доступ заборонено' });
    }

    const userResult = await query(
      'SELECT u.*, k.name as kiosk_name FROM users u LEFT JOIN kiosks k ON u.kiosk_id = k.id WHERE u.id = $1',
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Продавець не знайдено' });
    }

    const user = userResult.rows[0];

    // Get sales stats
    const salesStats = await query(
      `SELECT 
        COUNT(*) as total_sales,
        SUM(price) as total_revenue,
        SUM(quantity) as total_items
       FROM sales WHERE seller_id = $1`,
      [req.params.id]
    );

    // Get today's stats
    const todayStats = await query(
      `SELECT 
        COUNT(*) as sales_today,
        COALESCE(SUM(price), 0) as revenue_today
       FROM sales WHERE seller_id = $1 AND DATE(created_at) = CURRENT_DATE`,
      [req.params.id]
    );

    // Get recent sales
    const recentSales = await query(
      `SELECT s.*, p.name as product_name, k.name as kiosk_name
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       LEFT JOIN kiosks k ON s.kiosk_id = k.id
       WHERE s.seller_id = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [req.params.id]
    );

    res.json({
      ...user,
      stats: {
        total: salesStats.rows[0],
        today: todayStats.rows[0],
      },
      recent_sales: recentSales.rows,
    });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create employee (admin only)
router.post('/', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { username, password, full_name, kiosk_id } = req.body;

    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Логін, пароль та ПІБ обов\'язкові' });
    }

    // Check if username exists
    const existingUser = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Користувач з таким логіном вже існує' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query(
      'INSERT INTO users (username, password, full_name, role, kiosk_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name, role, kiosk_id',
      [username, hashedPassword, full_name, 'seller', kiosk_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update employee (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { username, password, full_name, kiosk_id } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (username) {
      // Check if username exists (excluding current user)
      const existingUser = await query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, req.params.id]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Користувач з таким логіном вже існує' });
      }
      updates.push(`username = $${paramCount}`);
      params.push(username);
      paramCount++;
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push(`password = $${paramCount}`);
      params.push(hashedPassword);
      paramCount++;
    }

    if (full_name) {
      updates.push(`full_name = $${paramCount}`);
      params.push(full_name);
      paramCount++;
    }

    if (kiosk_id !== undefined) {
      updates.push(`kiosk_id = $${paramCount}`);
      params.push(kiosk_id);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Немає даних для оновлення' });
    }

    params.push(req.params.id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, full_name, role, kiosk_id`;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Продавець не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete employee (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const result = await query('DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id', [req.params.id, 'seller']);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Продавець не знайдено' });
    }

    res.json({ message: 'Продавець видалено' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

