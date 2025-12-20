import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all inventory records
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id, status } = req.query;
    
    let sql = `
      SELECT 
        i.*,
        k.name as kiosk_name,
        u.full_name as created_by_name,
        COUNT(ii.id) as items_count,
        COUNT(CASE WHEN ii.difference != 0 THEN 1 END) as discrepancies_count
      FROM inventory i
      LEFT JOIN kiosks k ON i.kiosk_id = k.id
      LEFT JOIN users u ON i.created_by = u.id
      LEFT JOIN inventory_items ii ON i.id = ii.inventory_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (kiosk_id) {
      sql += ` AND i.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (status) {
      sql += ` AND i.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    sql += ` GROUP BY i.id, k.name, u.full_name ORDER BY i.created_at DESC`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get single inventory with items
router.get('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    // Get inventory
    const inventoryResult = await query(
      `SELECT 
        i.*,
        k.name as kiosk_name,
        u.full_name as created_by_name
       FROM inventory i
       LEFT JOIN kiosks k ON i.kiosk_id = k.id
       LEFT JOIN users u ON i.created_by = u.id
       WHERE i.id = $1`,
      [id]
    );

    if (inventoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Інвентаризація не знайдена' });
    }

    // Get items
    const itemsResult = await query(
      `SELECT 
        ii.*,
        p.name as product_name,
        p.brand,
        p.type,
        p.price
       FROM inventory_items ii
       LEFT JOIN products p ON ii.product_id = p.id
       WHERE ii.inventory_id = $1
       ORDER BY p.name`,
      [id]
    );

    res.json({
      ...inventoryResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create new inventory
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id, notes } = req.body;
    const created_by = req.user!.id;

    if (!kiosk_id) {
      return res.status(400).json({ error: 'Ларьок обов\'язковий' });
    }

    await query('BEGIN');

    try {
      // Create inventory
      const inventoryResult = await query(
        `INSERT INTO inventory (kiosk_id, created_by, notes, status)
         VALUES ($1, $2, $3, 'draft')
         RETURNING *`,
        [kiosk_id, created_by, notes || null]
      );

      const inventory = inventoryResult.rows[0];

      // Get all products for this kiosk
      const productsResult = await query(
        'SELECT id, name, quantity FROM products WHERE kiosk_id = $1 ORDER BY name',
        [kiosk_id]
      );

      // Create inventory items with system quantities
      for (const product of productsResult.rows) {
        await query(
          `INSERT INTO inventory_items (inventory_id, product_id, system_quantity)
           VALUES ($1, $2, $3)`,
          [inventory.id, product.id, product.quantity]
        );
      }

      await query('COMMIT');

      // Get full inventory with items
      const fullInventoryResult = await query(
        `SELECT 
          i.*,
          k.name as kiosk_name,
          u.full_name as created_by_name
         FROM inventory i
         LEFT JOIN kiosks k ON i.kiosk_id = k.id
         LEFT JOIN users u ON i.created_by = u.id
         WHERE i.id = $1`,
        [inventory.id]
      );

      const itemsResult = await query(
        `SELECT 
          ii.*,
          p.name as product_name,
          p.brand,
          p.type,
          p.price
         FROM inventory_items ii
         LEFT JOIN products p ON ii.product_id = p.id
         WHERE ii.inventory_id = $1
         ORDER BY p.name`,
        [inventory.id]
      );

      res.json({
        ...fullInventoryResult.rows[0],
        items: itemsResult.rows,
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Create inventory error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update inventory item (actual quantity)
router.put('/:id/items/:itemId', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id, itemId } = req.params;
    const { actual_quantity, notes } = req.body;

    // Check if inventory exists and can be edited
    const inventoryResult = await query(
      'SELECT status, completed_at FROM inventory WHERE id = $1',
      [id]
    );

    if (inventoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Інвентаризація не знайдена' });
    }

    const inventory = inventoryResult.rows[0];
    const ALLOWED_EDIT_HOURS = 2; // Allow editing completed inventories within 2 hours

    // Check if can edit
    if (inventory.status === 'cancelled') {
      return res.status(400).json({ error: 'Не можна редагувати скасовані інвентаризації' });
    }

    if (inventory.status === 'completed') {
      if (!inventory.completed_at) {
        return res.status(400).json({ error: 'Інвентаризація завершена, але дата завершення відсутня' });
      }

      const completedAt = new Date(inventory.completed_at);
      const now = new Date();
      const hoursDiff = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > ALLOWED_EDIT_HOURS) {
        return res.status(400).json({ 
          error: `Можна редагувати тільки протягом ${ALLOWED_EDIT_HOURS} годин після завершення. Пройшло ${hoursDiff.toFixed(1)} годин.` 
        });
      }
    }

    // Get item to calculate difference
    const itemResult = await query(
      'SELECT system_quantity FROM inventory_items WHERE id = $1 AND inventory_id = $2',
      [itemId, id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не знайдено' });
    }

    const systemQuantity = itemResult.rows[0].system_quantity;
    const actualQuantity = actual_quantity !== null && actual_quantity !== undefined 
      ? parseInt(String(actual_quantity)) 
      : null;
    const difference = actualQuantity !== null ? actualQuantity - systemQuantity : null;

    // Update item
    await query(
      `UPDATE inventory_items
       SET actual_quantity = $1,
           difference = $2,
           notes = $3
       WHERE id = $4 AND inventory_id = $5`,
      [actualQuantity, difference, notes || null, itemId, id]
    );

    res.json({ message: 'Оновлено успішно' });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Complete inventory (apply corrections)
router.post('/:id/complete', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    await query('BEGIN');

    try {
      // Check if inventory exists and is draft
      const inventoryResult = await query(
        'SELECT * FROM inventory WHERE id = $1',
        [id]
      );

      if (inventoryResult.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ error: 'Інвентаризація не знайдена' });
      }

      const inventory = inventoryResult.rows[0];
      const ALLOWED_RECOMPLETE_HOURS = 2; // Allow re-completing within 2 hours

      // Allow re-completing if it was completed within 2 hours
      if (inventory.status === 'completed') {
        if (!inventory.completed_at) {
          await query('ROLLBACK');
          return res.status(400).json({ error: 'Інвентаризація завершена, але дата завершення відсутня' });
        }

        const completedAt = new Date(inventory.completed_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > ALLOWED_RECOMPLETE_HOURS) {
          await query('ROLLBACK');
          return res.status(400).json({ 
            error: `Можна повторно завершити тільки протягом ${ALLOWED_RECOMPLETE_HOURS} годин після завершення. Пройшло ${hoursDiff.toFixed(1)} годин.` 
          });
        }

        // Revert to system_quantity first, then apply new actual_quantity
        const revertItemsResult = await query(
          `SELECT 
            ii.product_id,
            ii.system_quantity
           FROM inventory_items ii
           WHERE ii.inventory_id = $1`,
          [id]
        );

        for (const item of revertItemsResult.rows) {
          await query(
            `UPDATE products
             SET quantity = $1,
                 status = CASE WHEN $1 = 0 THEN 'out_of_stock' ELSE 'available' END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [item.system_quantity, item.product_id]
          );
        }
      } else if (inventory.status !== 'draft') {
        await query('ROLLBACK');
        return res.status(400).json({ error: 'Інвентаризація вже скасована' });
      }

      // Get all items with actual quantities
      const itemsResult = await query(
        `SELECT 
          ii.product_id,
          ii.actual_quantity,
          ii.difference
         FROM inventory_items ii
         WHERE ii.inventory_id = $1 AND ii.actual_quantity IS NOT NULL`,
        [id]
      );

      // Update product quantities
      for (const item of itemsResult.rows) {
        const newQuantity = item.actual_quantity;
        
        await query(
          `UPDATE products
           SET quantity = $1,
               status = CASE WHEN $1 = 0 THEN 'out_of_stock' ELSE 'available' END,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [newQuantity, item.product_id]
        );
      }

      // If re-completing (was completed before), we need to revert first
      // This handles the case when completing an already completed inventory
      // (which can happen if it was edited within 2 hours)

      // Mark inventory as completed
      await query(
        `UPDATE inventory
         SET status = 'completed',
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      await query('COMMIT');

      res.json({ message: 'Інвентаризація завершена, залишки оновлено' });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Complete inventory error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Cancel inventory (can cancel completed within 2 hours)
router.post('/:id/cancel', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    const ALLOWED_CANCEL_HOURS = 2; // Allow canceling completed inventories within 2 hours

    await query('BEGIN');

    try {
      const inventoryResult = await query(
        'SELECT status, completed_at FROM inventory WHERE id = $1',
        [id]
      );

      if (inventoryResult.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({ error: 'Інвентаризація не знайдена' });
      }

      const inventory = inventoryResult.rows[0];

      if (inventory.status === 'cancelled') {
        await query('ROLLBACK');
        return res.status(400).json({ error: 'Інвентаризація вже скасована' });
      }

      // If completed, check time limit and revert changes
      if (inventory.status === 'completed') {
        if (!inventory.completed_at) {
          await query('ROLLBACK');
          return res.status(400).json({ error: 'Інвентаризація завершена, але дата завершення відсутня' });
        }

        const completedAt = new Date(inventory.completed_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > ALLOWED_CANCEL_HOURS) {
          await query('ROLLBACK');
          return res.status(400).json({ 
            error: `Можна скасувати тільки протягом ${ALLOWED_CANCEL_HOURS} годин після завершення. Пройшло ${hoursDiff.toFixed(1)} годин.` 
          });
        }

        // Revert product quantities to system_quantity
        const itemsResult = await query(
          `SELECT 
            ii.product_id,
            ii.system_quantity
           FROM inventory_items ii
           WHERE ii.inventory_id = $1`,
          [id]
        );

        for (const item of itemsResult.rows) {
          await query(
            `UPDATE products
             SET quantity = $1,
                 status = CASE WHEN $1 = 0 THEN 'out_of_stock' ELSE 'available' END,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [item.system_quantity, item.product_id]
          );
        }
      }

      // Mark inventory as cancelled
      await query(
        `UPDATE inventory
         SET status = 'cancelled'
         WHERE id = $1`,
        [id]
      );

      await query('COMMIT');

      res.json({ message: 'Інвентаризація скасована' + (inventory.status === 'completed' ? ', залишки відкочено' : '') });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Cancel inventory error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete inventory (only draft)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    const inventoryResult = await query(
      'SELECT status FROM inventory WHERE id = $1',
      [id]
    );

    if (inventoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Інвентаризація не знайдена' });
    }

    if (inventoryResult.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Можна видалити тільки чернетки інвентаризацій' });
    }

    await query('DELETE FROM inventory WHERE id = $1', [id]);

    res.json({ message: 'Інвентаризація видалена' });
  } catch (error) {
    console.error('Delete inventory error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

