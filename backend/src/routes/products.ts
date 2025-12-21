import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { handleStockAfterProductChange } from '../services/stock.js';
import { logActionAfter } from '../middleware/actionLogger.js';

const router = express.Router();

// Get all products (with filters)
router.get('/', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { brand, type, minPrice, maxPrice, minQuantity, kiosk_id, search, status } = req.query;
    const isAdmin = (req as any).user?.role === 'admin';
    const userKioskId = (req as any).user?.kiosk_id;

    let sql = `SELECT p.*, k.name as kiosk_name,
      CASE 
        WHEN p.discount_percent > 0 
          AND (p.discount_start_date IS NULL OR p.discount_start_date <= CURRENT_DATE)
          AND (p.discount_end_date IS NULL OR p.discount_end_date >= CURRENT_DATE)
        THEN p.discount_percent
        ELSE 0
      END as active_discount_percent,
      CASE 
        WHEN p.discount_percent > 0 
          AND (p.discount_start_date IS NULL OR p.discount_start_date <= CURRENT_DATE)
          AND (p.discount_end_date IS NULL OR p.discount_end_date >= CURRENT_DATE)
        THEN p.price * (1 - p.discount_percent / 100)
        ELSE p.price
      END as final_price
      FROM products p LEFT JOIN kiosks k ON p.kiosk_id = k.id WHERE 1=1`;
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
      `SELECT p.*, k.name as kiosk_name,
        CASE 
          WHEN p.discount_percent > 0 
            AND (p.discount_start_date IS NULL OR p.discount_start_date <= CURRENT_DATE)
            AND (p.discount_end_date IS NULL OR p.discount_end_date >= CURRENT_DATE)
          THEN p.discount_percent
          ELSE 0
        END as active_discount_percent,
        CASE 
          WHEN p.discount_percent > 0 
            AND (p.discount_start_date IS NULL OR p.discount_start_date <= CURRENT_DATE)
            AND (p.discount_end_date IS NULL OR p.discount_end_date >= CURRENT_DATE)
          THEN p.price * (1 - p.discount_percent / 100)
          ELSE p.price
        END as final_price
       FROM products p LEFT JOIN kiosks k ON p.kiosk_id = k.id WHERE p.id = $1`,
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
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { name, brand, type, price, purchase_price, quantity, kiosk_id, status, create_expense, 
            discount_percent, discount_start_date, discount_end_date,
            low_stock_threshold, target_stock_level, auto_reorder } = req.body;
    const created_by = (req as any).user!.id;

    if (!name || !price || kiosk_id === undefined) {
      return res.status(400).json({ error: 'Назва, ціна та ларьок обов\'язкові' });
    }

    await query('BEGIN');

    try {
      // Normalize discount values: null/undefined/empty string -> null, otherwise parse as number
      const normalizedDiscountPercent = discount_percent !== null && discount_percent !== undefined && discount_percent !== ''
        ? (typeof discount_percent === 'string' ? parseFloat(discount_percent) : Number(discount_percent))
        : null;
      const normalizedDiscountStartDate = discount_start_date && discount_start_date !== '' ? discount_start_date : null;
      const normalizedDiscountEndDate = discount_end_date && discount_end_date !== '' ? discount_end_date : null;

      const result = await query(
        `INSERT INTO products (name, brand, type, price, purchase_price, quantity, kiosk_id, status, 
         discount_percent, discount_start_date, discount_end_date,
         low_stock_threshold, target_stock_level, auto_reorder)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [name, brand || null, type || null, price, purchase_price || null, quantity || 0, kiosk_id, status || 'available',
         normalizedDiscountPercent, normalizedDiscountStartDate, normalizedDiscountEndDate,
         low_stock_threshold ?? 5, target_stock_level ?? 10, auto_reorder ?? false]
      );

      const product = result.rows[0];

      // Автоматичне створення витрати "Закупівля" якщо вказано purchase_price та create_expense = true
      if (create_expense && purchase_price && quantity > 0) {
        const totalPurchaseAmount = parseFloat(purchase_price) * parseInt(quantity);
        await query(
          `INSERT INTO expenses (kiosk_id, category, description, amount, date, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            kiosk_id,
            'purchase',
            `Закупівля товару: ${name}${quantity > 1 ? ` (${quantity} шт.)` : ''}`,
            totalPurchaseAmount,
            new Date().toISOString().split('T')[0],
            created_by,
          ]
        );
      }

      await query('COMMIT');
      // Update low-stock alerts and auto reorder draft for this product
      try {
        await handleStockAfterProductChange({ product_id: Number(product.id) });
      } catch (e) {
        console.error('Stock check after product create failed:', e);
      }
      res.status(201).json(product);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('Create product error:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      constraint: error?.constraint,
    });
    res.status(500).json({ 
      error: 'Помилка сервера',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// Update product (admin only)
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { name, brand, type, price, purchase_price, quantity, kiosk_id, status,
            discount_percent, discount_start_date, discount_end_date,
            low_stock_threshold, target_stock_level, auto_reorder } = req.body;

    // Normalize discount values: null/undefined/empty string -> null, otherwise parse as number
    // For update, we need to distinguish between "not provided" (undefined) and "set to null" (null)
    // If discount_percent is explicitly null, we want to clear it; if undefined, keep existing value
    const normalizedDiscountPercent = discount_percent !== undefined
      ? (discount_percent !== null && discount_percent !== '' 
          ? (typeof discount_percent === 'string' ? parseFloat(discount_percent) : Number(discount_percent))
          : null)
      : undefined;
    const normalizedDiscountStartDate = discount_start_date !== undefined
      ? (discount_start_date && discount_start_date !== '' ? discount_start_date : null)
      : undefined;
    const normalizedDiscountEndDate = discount_end_date !== undefined
      ? (discount_end_date && discount_end_date !== '' ? discount_end_date : null)
      : undefined;

    // Build dynamic update query based on what fields are provided
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      params.push(name);
      paramCount++;
    }
    if (brand !== undefined) {
      updates.push(`brand = $${paramCount}`);
      params.push(brand || null);
      paramCount++;
    }
    if (type !== undefined) {
      updates.push(`type = $${paramCount}`);
      params.push(type || null);
      paramCount++;
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount}`);
      params.push(price);
      paramCount++;
    }
    if (purchase_price !== undefined) {
      updates.push(`purchase_price = $${paramCount}`);
      params.push(purchase_price || null);
      paramCount++;
    }
    if (quantity !== undefined) {
      updates.push(`quantity = $${paramCount}`);
      params.push(quantity);
      paramCount++;
    }
    if (kiosk_id !== undefined) {
      updates.push(`kiosk_id = $${paramCount}`);
      params.push(kiosk_id);
      paramCount++;
    }
    if (normalizedDiscountPercent !== undefined) {
      updates.push(`discount_percent = $${paramCount}`);
      params.push(normalizedDiscountPercent);
      paramCount++;
    }
    if (normalizedDiscountStartDate !== undefined) {
      updates.push(`discount_start_date = $${paramCount}`);
      params.push(normalizedDiscountStartDate);
      paramCount++;
    }
    if (normalizedDiscountEndDate !== undefined) {
      updates.push(`discount_end_date = $${paramCount}`);
      params.push(normalizedDiscountEndDate);
      paramCount++;
    }
    if (low_stock_threshold !== undefined) {
      updates.push(`low_stock_threshold = $${paramCount}`);
      params.push(low_stock_threshold);
      paramCount++;
    }
    if (target_stock_level !== undefined) {
      updates.push(`target_stock_level = $${paramCount}`);
      params.push(target_stock_level);
      paramCount++;
    }
    if (auto_reorder !== undefined) {
      updates.push(`auto_reorder = $${paramCount}`);
      params.push(auto_reorder);
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

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(req.params.id);
    const sql = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не знайдено' });
    }

    // Update low-stock alerts and auto reorder draft for this product
    try {
      await handleStockAfterProductChange({ product_id: Number(req.params.id) });
    } catch (e) {
      console.error('Stock check after product update failed:', e);
    }

    const updatedProduct = result.rows[0];
    
    // Логування дії
    await logActionAfter((req as any).user?.id, {
      actionType: 'update',
      entityType: 'product',
      entityId: Number(req.params.id),
      description: `Оновлено товар: ${updatedProduct.name}`,
      changes: Object.fromEntries(
        Object.entries(req.body).filter(([_, v]) => v !== undefined)
      ),
      ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
    });

    res.json(updatedProduct);
  } catch (error: any) {
    console.error('Update product error:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      constraint: error?.constraint,
      body: req.body,
    });
    res.status(500).json({ 
      error: 'Помилка сервера',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// Bulk import products (admin only)
router.post('/bulk-import', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { products: productsToImport, create_expenses } = req.body;
    const created_by = (req as any).user!.id;

    if (!Array.isArray(productsToImport) || productsToImport.length === 0) {
      return res.status(400).json({ error: 'Список товарів обов\'язковий' });
    }

    await query('BEGIN');

    try {
      const createdProducts = [];
      let totalExpenseAmount = 0;

      for (const productData of productsToImport) {
        const { name, brand, type, price, purchase_price, quantity, kiosk_id, status } = productData;

        if (!name || !price || kiosk_id === undefined) {
          throw new Error(`Товар "${name || 'невідомий'}" має невалідні дані`);
        }

        const result = await query(
          `INSERT INTO products (name, brand, type, price, purchase_price, quantity, kiosk_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [name, brand || null, type || null, price, purchase_price || null, quantity || 0, kiosk_id, status || 'available']
        );

        createdProducts.push(result.rows[0]);

        // Автоматичне створення витрати "Закупівля" якщо вказано
        if (create_expenses && purchase_price && quantity > 0) {
          const purchaseAmount = parseFloat(purchase_price) * parseInt(quantity);
          totalExpenseAmount += purchaseAmount;
        }
      }

      // Створити одну витрату для всіх імпортованих товарів
      if (create_expenses && totalExpenseAmount > 0) {
        const kioskId = productsToImport[0].kiosk_id;
        await query(
          `INSERT INTO expenses (kiosk_id, category, description, amount, date, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            kioskId,
            'purchase',
            `Масовий імпорт товарів (${productsToImport.length} товарів)`,
            totalExpenseAmount,
            new Date().toISOString().split('T')[0],
            created_by,
          ]
        );
      }

      await query('COMMIT');
      res.status(201).json({
        message: `Успішно імпортовано ${createdProducts.length} товарів`,
        products: createdProducts,
        expense_created: create_expenses && totalExpenseAmount > 0,
      });
    } catch (error: any) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('Bulk import products error:', error);
    res.status(500).json({ error: error.message || 'Помилка сервера' });
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

// Bulk update prices (admin only)
router.put('/bulk-update-prices', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { updates, updateType, value } = req.body;
    // updates: [{ id, price }] або updateType: 'percent'/'fixed', value: число

    if (!updates && (!updateType || value === undefined)) {
      return res.status(400).json({ error: 'Потрібні дані для оновлення' });
    }

    await query('BEGIN');

    try {
      if (updates && Array.isArray(updates)) {
        // Оновлення конкретних товарів
        for (const update of updates) {
          if (update.id && update.price !== undefined) {
            await query(
              'UPDATE products SET price = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
              [update.price, update.id]
            );
          }
        }
      } else if (updateType && value !== undefined) {
        // Масове оновлення за фільтрами
        let sql = 'UPDATE products SET';
        const params: any[] = [];
        let paramCount = 1;

        if (updateType === 'percent') {
          sql += ` price = price * (1 + $${paramCount} / 100),`;
          params.push(parseFloat(value));
          paramCount++;
        } else if (updateType === 'fixed') {
          sql += ` price = price + $${paramCount},`;
          params.push(parseFloat(value));
          paramCount++;
        } else {
          throw new Error('Невірний тип оновлення');
        }

        sql += ' updated_at = CURRENT_TIMESTAMP WHERE 1=1';

        // Додати фільтри якщо є
        if (req.body.brand) {
          sql += ` AND brand = $${paramCount}`;
          params.push(req.body.brand);
          paramCount++;
        }
        if (req.body.type) {
          sql += ` AND type = $${paramCount}`;
          params.push(req.body.type);
          paramCount++;
        }
        if (req.body.kiosk_id) {
          sql += ` AND kiosk_id = $${paramCount}`;
          params.push(req.body.kiosk_id);
          paramCount++;
        }
        if (req.body.status) {
          sql += ` AND status = $${paramCount}`;
          params.push(req.body.status);
          paramCount++;
        }

        await query(sql, params);
      }

      await query('COMMIT');
      res.json({ message: 'Ціни успішно оновлено' });
    } catch (error: any) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error: any) {
    console.error('Bulk update prices error:', error);
    res.status(500).json({ error: error.message || 'Помилка сервера' });
  }
});

export default router;

