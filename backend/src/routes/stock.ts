import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Low stock count for badge/polling (admin)
router.get('/low/count', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id } = req.query;
    const params: any[] = [];
    let where = `WHERE p.quantity <= COALESCE(p.low_stock_threshold, 5)`;
    let paramCount = 1;

    if (kiosk_id) {
      where += ` AND p.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    const result = await query(
      `
      SELECT COUNT(*)::int as count
      FROM products p
      ${where}
      `,
      params
    );

    res.json({ count: result.rows[0]?.count ?? 0 });
  } catch (error) {
    console.error('Low stock count error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Low stock products (admin)
router.get('/low', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    let paramCount = 1;

    if (kiosk_id) {
      where += ` AND p.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    const result = await query(
      `
      SELECT 
        p.id,
        p.name,
        p.brand,
        p.type,
        p.kiosk_id,
        k.name as kiosk_name,
        p.quantity,
        COALESCE(p.low_stock_threshold, 5) as low_stock_threshold,
        COALESCE(p.target_stock_level, 10) as target_stock_level,
        COALESCE(p.auto_reorder, FALSE) as auto_reorder,
        CASE WHEN p.quantity <= COALESCE(p.low_stock_threshold, 5) THEN TRUE ELSE FALSE END as is_low,
        GREATEST(0, COALESCE(p.target_stock_level, 10) - p.quantity) as recommended_qty,
        sa.id as alert_id,
        sa.status as alert_status,
        sa.triggered_at as alert_triggered_at
      FROM products p
      LEFT JOIN kiosks k ON p.kiosk_id = k.id
      LEFT JOIN stock_alerts sa ON sa.product_id = p.id AND sa.kiosk_id = p.kiosk_id AND sa.status = 'active'
      ${where}
      AND p.quantity <= COALESCE(p.low_stock_threshold, 5)
      ORDER BY p.kiosk_id, p.quantity ASC, p.name ASC
      `,
      params
    );

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Low stock error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Draft auto-generated orders (admin)
router.get('/orders', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id, status } = req.query;
    const params: any[] = [];
    let where = 'WHERE 1=1';
    let paramCount = 1;

    const orderStatus = status ? String(status) : 'draft';
    where += ` AND po.status = $${paramCount}`;
    params.push(orderStatus);
    paramCount++;

    if (kiosk_id) {
      where += ` AND po.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    const ordersRes = await query(
      `
      SELECT po.*, k.name as kiosk_name
      FROM purchase_orders po
      LEFT JOIN kiosks k ON po.kiosk_id = k.id
      ${where}
      ORDER BY po.updated_at DESC, po.created_at DESC
      `,
      params
    );

    const orders = [];
    for (const order of ordersRes.rows) {
      const itemsRes = await query(
        `
        SELECT poi.*, p.name, p.brand, p.type
        FROM purchase_order_items poi
        LEFT JOIN products p ON poi.product_id = p.id
        WHERE poi.order_id = $1
        ORDER BY poi.recommended_qty DESC, p.name ASC
        `,
        [order.id]
      );
      orders.push({ ...order, items: itemsRes.rows });
    }

    res.json({ orders });
  } catch (error) {
    console.error('Orders error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Confirm draft order (admin)
router.post('/orders/:id/confirm', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const id = req.params.id;
    const updated = await query(
      `UPDATE purchase_orders
       SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [id]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Замовлення не знайдено або вже підтверджено' });
    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Confirm order error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Resolve alert manually (admin)
router.post('/alerts/:id/resolve', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const id = req.params.id;
    const updated = await query(
      `UPDATE stock_alerts
       SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'active'
       RETURNING *`,
      [id]
    );
    if (updated.rows.length === 0) return res.status(404).json({ error: 'Алерт не знайдено або вже закрито' });
    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;


