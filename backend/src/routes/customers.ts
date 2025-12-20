import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all customers
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { search, sort = 'name' } = req.query;
    
    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (search) {
      sql += ` AND (name ILIKE $${paramCount} OR phone ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Sorting
    const sortField = sort === 'purchases' ? 'total_purchases' : 
                     sort === 'visits' ? 'total_visits' :
                     sort === 'points' ? 'loyalty_points' : 'name';
    const sortOrder = sort === 'purchases' || sort === 'visits' || sort === 'points' ? 'DESC' : 'ASC';
    sql += ` ORDER BY ${sortField} ${sortOrder}`;

    const result = await query(sql, params.length > 0 ? params : undefined);
    res.json(result.rows);
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get single customer with stats
router.get('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    
    // Validate id is a number
    if (isNaN(Number(id))) {
      return res.status(400).json({ error: 'Невірний ID клієнта' });
    }

    // Get customer
    const customerResult = await query(
      'SELECT * FROM customers WHERE id = $1',
      [id]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Клієнт не знайдено' });
    }

    const customer = customerResult.rows[0];

    // Get purchase history
    const salesResult = await query(
      `SELECT 
        s.*,
        p.name as product_name,
        p.brand,
        p.type,
        u.full_name as seller_name,
        k.name as kiosk_name
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       LEFT JOIN users u ON s.seller_id = u.id
       LEFT JOIN kiosks k ON s.kiosk_id = k.id
       WHERE s.customer_id = $1
       ORDER BY s.created_at DESC
       LIMIT 50`,
      [id]
    );

    // Get statistics
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(s.price), 0) as total_spent,
        COUNT(DISTINCT DATE(s.created_at)) as unique_visits,
        MIN(s.created_at) as first_purchase,
        MAX(s.created_at) as last_purchase
       FROM sales s
       WHERE s.customer_id = $1`,
      [id]
    );

    res.json({
      ...customer,
      sales: salesResult.rows,
      stats: statsResult.rows[0] || {},
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create customer
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { name, phone, email, notes } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Ім\'я клієнта обов\'язкове' });
    }

    const result = await query(
      `INSERT INTO customers (name, phone, email, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), phone?.trim() || null, email?.trim() || null, notes?.trim() || null]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update customer
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    
    // Validate id is a number
    if (isNaN(Number(id))) {
      return res.status(400).json({ error: 'Невірний ID клієнта' });
    }
    
    const { name, phone, email, notes, loyalty_points } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Ім\'я клієнта обов\'язкове' });
    }

    const result = await query(
      `UPDATE customers
       SET name = $1,
           phone = $2,
           email = $3,
           notes = $4,
           loyalty_points = COALESCE($5, loyalty_points),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        name.trim(),
        phone?.trim() || null,
        email?.trim() || null,
        notes?.trim() || null,
        loyalty_points !== undefined ? parseInt(String(loyalty_points)) : null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Клієнт не знайдено' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete customer
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    
    // Validate id is a number
    if (isNaN(Number(id))) {
      return res.status(400).json({ error: 'Невірний ID клієнта' });
    }

    // Check if customer has sales
    const salesCheck = await query(
      'SELECT COUNT(*) as count FROM sales WHERE customer_id = $1',
      [id]
    );

    if (parseInt(salesCheck.rows[0]?.count || '0') > 0) {
      // Instead of deleting, just remove customer_id from sales
      await query('UPDATE sales SET customer_id = NULL WHERE customer_id = $1', [id]);
    }

    await query('DELETE FROM customers WHERE id = $1', [id]);

    res.json({ message: 'Клієнт видалено' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update customer stats after sale
export async function updateCustomerStats(customerId: number, saleAmount: number) {
  try {
    await query(
      `UPDATE customers
       SET total_purchases = total_purchases + $1,
           total_visits = total_visits + 1,
           last_visit = CURRENT_TIMESTAMP,
           loyalty_points = loyalty_points + FLOOR($1 / 10),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [saleAmount, customerId]
    );
  } catch (error) {
    console.error('Update customer stats error:', error);
  }
}

export default router;

