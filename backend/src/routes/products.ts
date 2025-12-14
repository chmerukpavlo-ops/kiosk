import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all products (with filters)
router.get('/', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { brand, type, minPrice, maxPrice, minQuantity, kiosk_id, search, status } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const userKioskId = req.user?.kiosk_id;

    let sql = 'SELECT p.*, k.name as kiosk_name FROM products p LEFT JOIN kiosks k ON p.kiosk_id = k.id WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    // Filter by kiosk (sellers only see their kiosk)
    if (!isAdmin && userKioskId) {
      sql += ` AND p.kiosk_id = $${paramCount}`;
      params.push(userKioskId);
      paramCount++;
    } else if (kiosk_id) {
      sql += ` AND p.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (brand) {
      sql += ` AND p.brand = $${paramCount}`;
      params.push(brand);
      paramCount++;
    }

    if (type) {
      sql += ` AND p.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (minPrice) {
      sql += ` AND p.price >= $${paramCount}`;
      params.push(minPrice);
      paramCount++;
    }

    if (maxPrice) {
      sql += ` AND p.price <= $${paramCount}`;
      params.push(maxPrice);
      paramCount++;
    }

    if (minQuantity !== undefined) {
      sql += ` AND p.quantity >= $${paramCount}`;
      params.push(minQuantity);
      paramCount++;
    }

    if (status) {
      sql += ` AND p.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (search) {
      sql += ` AND (p.name ILIKE $${paramCount} OR p.brand ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    sql += ' ORDER BY p.created_at DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get single product
router.get('/:id', authenticate, async (req: express.Request, res: express.Response) => {
  try {
    const result = await query(
      'SELECT p.*, k.name as kiosk_name FROM products p LEFT JOIN kiosks k ON p.kiosk_id = k.id WHERE p.id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create product (admin only)
router.post('/', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { name, brand, type, price, purchase_price, quantity, kiosk_id, status } = req.body;

    if (!name || !price || kiosk_id === undefined) {
      return res.status(400).json({ error: 'Назва, ціна та ларьок обов\'язкові' });
    }

    const result = await query(
      `INSERT INTO products (name, brand, type, price, purchase_price, quantity, kiosk_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, brand || null, type || null, price, purchase_price || null, quantity || 0, kiosk_id, status || 'available']
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update product (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { name, brand, type, price, purchase_price, quantity, kiosk_id, status } = req.body;

    const result = await query(
      `UPDATE products 
       SET name = COALESCE($1, name),
           brand = COALESCE($2, brand),
           type = COALESCE($3, type),
           price = COALESCE($4, price),
           purchase_price = COALESCE($5, purchase_price),
           quantity = COALESCE($6, quantity),
           kiosk_id = COALESCE($7, kiosk_id),
           status = COALESCE($8, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, brand, type, price, purchase_price, quantity, kiosk_id, status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const result = await query('DELETE FROM products WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не знайдено' });
    }

    res.json({ message: 'Товар видалено' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

