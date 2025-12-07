import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all kiosks
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await query('SELECT * FROM kiosks ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get kiosks error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get single kiosk with stats
router.get('/:id', authenticate, async (req, res) => {
  try {
    const kioskResult = await query('SELECT * FROM kiosks WHERE id = $1', [req.params.id]);
    
    if (kioskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ларьок не знайдено' });
    }

    const kiosk = kioskResult.rows[0];

    // Get products count
    const productsResult = await query(
      'SELECT COUNT(*) as total, SUM(quantity) as total_quantity FROM products WHERE kiosk_id = $1',
      [req.params.id]
    );

    // Get sales stats
    const salesResult = await query(
      `SELECT 
        COUNT(*) as total_sales,
        SUM(price) as total_revenue,
        SUM(commission) as total_commission
       FROM sales WHERE kiosk_id = $1`,
      [req.params.id]
    );

    // Get employees
    const employeesResult = await query(
      'SELECT id, username, full_name, role FROM users WHERE kiosk_id = $1',
      [req.params.id]
    );

    res.json({
      ...kiosk,
      stats: {
        products: productsResult.rows[0],
        sales: salesResult.rows[0],
      },
      employees: employeesResult.rows,
    });
  } catch (error) {
    console.error('Get kiosk error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create kiosk (admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, address } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: 'Назва та адреса обов\'язкові' });
    }

    const result = await query(
      'INSERT INTO kiosks (name, address) VALUES ($1, $2) RETURNING *',
      [name, address]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create kiosk error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update kiosk (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, address } = req.body;

    const result = await query(
      'UPDATE kiosks SET name = COALESCE($1, name), address = COALESCE($2, address) WHERE id = $3 RETURNING *',
      [name, address, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ларьок не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update kiosk error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete kiosk (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM kiosks WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ларьок не знайдено' });
    }

    res.json({ message: 'Ларьок видалено' });
  } catch (error) {
    console.error('Delete kiosk error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get kiosk sales
router.get('/:id/sales', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let sql = `
      SELECT s.*, 
             p.name as product_name,
             u.full_name as seller_name
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN users u ON s.seller_id = u.id
      WHERE s.kiosk_id = $1
    `;
    const params: any[] = [req.params.id];

    if (startDate && endDate) {
      sql += ` AND DATE(s.created_at) BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    sql += ' ORDER BY s.created_at DESC LIMIT 500';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get kiosk sales error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get kiosk products
router.get('/:id/products', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM products WHERE kiosk_id = $1 ORDER BY name',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get kiosk products error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

