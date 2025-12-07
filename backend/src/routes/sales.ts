import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all sales
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { date, seller_id, kiosk_id, startDate, endDate } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const userId = req.user?.id;

    let sql = `
      SELECT s.*, 
             p.name as product_name,
             u.full_name as seller_name,
             k.name as kiosk_name
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN users u ON s.seller_id = u.id
      LEFT JOIN kiosks k ON s.kiosk_id = k.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    // Sellers only see their sales
    if (!isAdmin && userId) {
      sql += ` AND s.seller_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (seller_id) {
      sql += ` AND s.seller_id = $${paramCount}`;
      params.push(seller_id);
      paramCount++;
    }

    if (kiosk_id) {
      sql += ` AND s.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (date) {
      sql += ` AND DATE(s.created_at) = $${paramCount}`;
      params.push(date);
      paramCount++;
    }

    if (startDate && endDate) {
      sql += ` AND DATE(s.created_at) BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    }

    sql += ' ORDER BY s.created_at DESC LIMIT 1000';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create sale (sell product)
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    const seller_id = req.user!.id;
    const isAdmin = req.user?.role === 'admin';

    if (!product_id) {
      return res.status(400).json({ error: 'ID товару обов\'язковий' });
    }

    // Get product
    const productResult = await query(
      'SELECT * FROM products WHERE id = $1',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не знайдено' });
    }

    const product = productResult.rows[0];

    // Check if seller has access to this product's kiosk
    if (!isAdmin && req.user?.kiosk_id !== product.kiosk_id) {
      return res.status(403).json({ error: 'Немає доступу до цього товару' });
    }

    // Check quantity
    if (product.quantity < quantity) {
      return res.status(400).json({ error: 'Недостатня кількість товару' });
    }

    // Get seller's kiosk
    const userResult = await query('SELECT kiosk_id FROM users WHERE id = $1', [seller_id]);
    const kiosk_id = userResult.rows[0]?.kiosk_id || product.kiosk_id;

    // Calculate commission (12%)
    const totalPrice = product.price * quantity;
    const commission = totalPrice * 0.12;

    // Start transaction
    await query('BEGIN');

    try {
      // Create sale
      const saleResult = await query(
        `INSERT INTO sales (product_id, seller_id, kiosk_id, quantity, price, commission)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [product_id, seller_id, kiosk_id, quantity, totalPrice, commission]
      );

      // Update product quantity
      const newQuantity = product.quantity - quantity;
      await query(
        `UPDATE products 
         SET quantity = $1, 
             status = CASE WHEN $1 = 0 THEN 'out_of_stock' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newQuantity, product_id]
      );

      await query('COMMIT');

      // Get sale with details
      const fullSaleResult = await query(
        `SELECT s.*, 
                p.name as product_name,
                u.full_name as seller_name,
                k.name as kiosk_name
         FROM sales s
         LEFT JOIN products p ON s.product_id = p.id
         LEFT JOIN users u ON s.seller_id = u.id
         LEFT JOIN kiosks k ON s.kiosk_id = k.id
         WHERE s.id = $1`,
        [saleResult.rows[0].id]
      );

      res.status(201).json(fullSaleResult.rows[0]);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get sales statistics
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const { period = 'day', kiosk_id, seller_id } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const userId = req.user?.id;

    let dateFilter = '';
    if (period === 'day') {
      dateFilter = "DATE(created_at) = CURRENT_DATE";
    } else if (period === 'week') {
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    let sql = `SELECT 
      COUNT(*) as total_sales,
      SUM(price) as total_revenue,
      SUM(commission) as total_commission,
      SUM(quantity) as total_items
    FROM sales WHERE ${dateFilter}`;

    const params: any[] = [];
    let paramCount = 1;

    if (!isAdmin && userId) {
      sql += ` AND seller_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (kiosk_id) {
      sql += ` AND kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (seller_id) {
      sql += ` AND seller_id = $${paramCount}`;
      params.push(seller_id);
      paramCount++;
    }

    const result = await query(sql, params);
    res.json(result.rows[0] || { total_sales: 0, total_revenue: 0, total_commission: 0, total_items: 0 });
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

