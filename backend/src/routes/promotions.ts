import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all promotions
router.get('/', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { active, type } = req.query;
    let sql = `
      SELECT p.*, 
             u.full_name as created_by_name,
             COUNT(pp.product_id) as product_count
      FROM promotions p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN promotion_products pp ON p.id = pp.promotion_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (active === 'true') {
      sql += ` AND p.is_active = true 
               AND p.start_date <= CURRENT_DATE 
               AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)`;
    }

    if (type) {
      sql += ` AND p.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    sql += ` GROUP BY p.id, u.full_name ORDER BY p.created_at DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get promotions error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get active promotions for products
router.get('/active', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { product_id, category, brand } = req.query;
    
    let sql = `
      SELECT DISTINCT p.*
      FROM promotions p
      WHERE p.is_active = true
        AND p.start_date <= CURRENT_DATE
        AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
    `;
    const params: any[] = [];
    let paramCount = 1;

    // Filter by product
    if (product_id) {
      sql += ` AND (
        p.applicable_to = 'all' OR
        (p.applicable_to = 'products' AND $${paramCount} = ANY(p.product_ids)) OR
        EXISTS (
          SELECT 1 FROM promotion_products pp 
          WHERE pp.promotion_id = p.id AND pp.product_id = $${paramCount}
        )
      )`;
      params.push(parseInt(String(product_id)));
      paramCount++;
    }

    // Filter by category
    if (category) {
      sql += ` AND (
        p.applicable_to = 'all' OR
        (p.applicable_to = 'category' AND p.category_filter = $${paramCount})
      )`;
      params.push(category);
      paramCount++;
    }

    // Filter by brand
    if (brand) {
      sql += ` AND (
        p.applicable_to = 'all' OR
        (p.applicable_to = 'brand' AND p.brand_filter = $${paramCount})
      )`;
      params.push(brand);
      paramCount++;
    }

    sql += ` ORDER BY p.discount_percent DESC NULLS LAST, p.discount_amount DESC NULLS LAST`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get active promotions error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get promotion by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await query(
      `SELECT p.*, 
              u.full_name as created_by_name,
              array_agg(pp.product_id) as product_ids
       FROM promotions p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN promotion_products pp ON p.id = pp.promotion_id
       WHERE p.id = $1
       GROUP BY p.id, u.full_name`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Акцію не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get promotion error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create promotion (admin only)
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const {
      name,
      description,
      type,
      discount_percent,
      discount_amount,
      start_date,
      end_date,
      is_active = true,
      min_purchase_amount,
      max_discount_amount,
      applicable_to = 'all',
      category_filter,
      brand_filter,
      product_ids,
    } = req.body;

    if (!name || !type || !start_date) {
      return res.status(400).json({ error: 'Назва, тип та дата початку обов\'язкові' });
    }

    if (type === 'percentage' && (!discount_percent || discount_percent < 0 || discount_percent > 100)) {
      return res.status(400).json({ error: 'Відсоток знижки повинен бути від 0 до 100' });
    }

    if (type === 'fixed' && (!discount_amount || discount_amount < 0)) {
      return res.status(400).json({ error: 'Сума знижки повинна бути більше 0' });
    }

    const created_by = req.user?.id;

    const result = await query(
      `INSERT INTO promotions (
        name, description, type, discount_percent, discount_amount,
        start_date, end_date, is_active, min_purchase_amount, max_discount_amount,
        applicable_to, category_filter, brand_filter, product_ids, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        name,
        description || null,
        type,
        discount_percent || null,
        discount_amount || null,
        start_date,
        end_date || null,
        is_active,
        min_purchase_amount || null,
        max_discount_amount || null,
        applicable_to,
        category_filter || null,
        brand_filter || null,
        product_ids || null,
        created_by,
      ]
    );

    const promotion = result.rows[0];

    // Add products to promotion_products if applicable_to is 'products' and product_ids provided
    if (applicable_to === 'products' && product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
      for (const productId of product_ids) {
        await query(
          'INSERT INTO promotion_products (promotion_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [promotion.id, productId]
        );
      }
    }

    res.status(201).json(promotion);
  } catch (error: any) {
    console.error('Create promotion error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update promotion (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const {
      name,
      description,
      type,
      discount_percent,
      discount_amount,
      start_date,
      end_date,
      is_active,
      min_purchase_amount,
      max_discount_amount,
      applicable_to,
      category_filter,
      brand_filter,
      product_ids,
    } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      params.push(name);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description || null);
      paramCount++;
    }
    if (type !== undefined) {
      updates.push(`type = $${paramCount}`);
      params.push(type);
      paramCount++;
    }
    if (discount_percent !== undefined) {
      updates.push(`discount_percent = $${paramCount}`);
      params.push(discount_percent || null);
      paramCount++;
    }
    if (discount_amount !== undefined) {
      updates.push(`discount_amount = $${paramCount}`);
      params.push(discount_amount || null);
      paramCount++;
    }
    if (start_date !== undefined) {
      updates.push(`start_date = $${paramCount}`);
      params.push(start_date);
      paramCount++;
    }
    if (end_date !== undefined) {
      updates.push(`end_date = $${paramCount}`);
      params.push(end_date || null);
      paramCount++;
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      params.push(is_active);
      paramCount++;
    }
    if (min_purchase_amount !== undefined) {
      updates.push(`min_purchase_amount = $${paramCount}`);
      params.push(min_purchase_amount || null);
      paramCount++;
    }
    if (max_discount_amount !== undefined) {
      updates.push(`max_discount_amount = $${paramCount}`);
      params.push(max_discount_amount || null);
      paramCount++;
    }
    if (applicable_to !== undefined) {
      updates.push(`applicable_to = $${paramCount}`);
      params.push(applicable_to);
      paramCount++;
    }
    if (category_filter !== undefined) {
      updates.push(`category_filter = $${paramCount}`);
      params.push(category_filter || null);
      paramCount++;
    }
    if (brand_filter !== undefined) {
      updates.push(`brand_filter = $${paramCount}`);
      params.push(brand_filter || null);
      paramCount++;
    }
    if (product_ids !== undefined) {
      updates.push(`product_ids = $${paramCount}`);
      params.push(product_ids || null);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Немає даних для оновлення' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(req.params.id);
    const sql = `UPDATE promotions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Акцію не знайдено' });
    }

    // Update promotion_products if applicable_to is 'products'
    if (applicable_to === 'products' && product_ids && Array.isArray(product_ids)) {
      // Remove old associations
      await query('DELETE FROM promotion_products WHERE promotion_id = $1', [req.params.id]);
      
      // Add new associations
      for (const productId of product_ids) {
        await query(
          'INSERT INTO promotion_products (promotion_id, product_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, productId]
        );
      }
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update promotion error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete promotion (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await query('DELETE FROM promotions WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Акцію не знайдено' });
    }

    res.json({ message: 'Акцію видалено' });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

