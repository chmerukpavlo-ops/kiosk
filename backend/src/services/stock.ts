import { query } from '../db/init.js';

type StockCheckOptions = {
  product_id: number;
};

function toInt(value: any, fallback = 0) {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function handleStockAfterProductChange(opts: StockCheckOptions) {
  const { product_id } = opts;

  const productRes = await query(
    `SELECT id, kiosk_id, name, quantity, 
            COALESCE(low_stock_threshold, 5) as low_stock_threshold,
            COALESCE(target_stock_level, 10) as target_stock_level,
            COALESCE(auto_reorder, FALSE) as auto_reorder
     FROM products
     WHERE id = $1`,
    [product_id]
  );

  if (productRes.rows.length === 0) return;

  const p = productRes.rows[0];
  const kiosk_id = p.kiosk_id;
  if (kiosk_id === null || kiosk_id === undefined) return;
  const quantity = toInt(p.quantity, 0);
  const threshold = toInt(p.low_stock_threshold, 5);
  const target = Math.max(threshold, toInt(p.target_stock_level, 10));
  const auto_reorder = !!p.auto_reorder;

  const isLow = quantity <= threshold;

  if (isLow) {
    // Upsert active alert (anti-spam via partial unique index)
    await query(
      `INSERT INTO stock_alerts (product_id, kiosk_id, status, threshold, quantity_at_trigger, triggered_at, last_notified_at)
       VALUES ($1, $2, 'active', $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (product_id, kiosk_id) WHERE status = 'active'
       DO UPDATE SET
         threshold = EXCLUDED.threshold,
         quantity_at_trigger = EXCLUDED.quantity_at_trigger,
         last_notified_at = CURRENT_TIMESTAMP`,
      [product_id, kiosk_id, threshold, quantity]
    );

    if (auto_reorder) {
      // Find or create draft auto-generated order for kiosk
      const orderRes = await query(
        `SELECT id FROM purchase_orders 
         WHERE kiosk_id = $1 AND status = 'draft' AND auto_generated = TRUE
         ORDER BY created_at DESC
         LIMIT 1`,
        [kiosk_id]
      );

      let orderId = orderRes.rows[0]?.id;
      if (!orderId) {
        const created = await query(
          `INSERT INTO purchase_orders (kiosk_id, status, auto_generated)
           VALUES ($1, 'draft', TRUE)
           RETURNING id`,
          [kiosk_id]
        );
        orderId = created.rows[0].id;
      }

      const recommended = Math.max(0, target - quantity);

      await query(
        `INSERT INTO purchase_order_items (order_id, product_id, current_qty, threshold, target_level, recommended_qty)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (order_id, product_id)
         DO UPDATE SET
           current_qty = EXCLUDED.current_qty,
           threshold = EXCLUDED.threshold,
           target_level = EXCLUDED.target_level,
           recommended_qty = EXCLUDED.recommended_qty,
           updated_at = CURRENT_TIMESTAMP`,
        [orderId, product_id, quantity, threshold, target, recommended]
      );
    }
  } else {
    // Resolve active alert (if any)
    await query(
      `UPDATE stock_alerts
       SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
       WHERE product_id = $1 AND kiosk_id = $2 AND status = 'active'`,
      [product_id, kiosk_id]
    );

    // Clean up from draft auto-generated orders (optional)
    await query(
      `DELETE FROM purchase_order_items poi
       USING purchase_orders po
       WHERE poi.order_id = po.id
         AND po.kiosk_id = $1
         AND po.status = 'draft'
         AND po.auto_generated = TRUE
         AND poi.product_id = $2`,
      [kiosk_id, product_id]
    );
  }
}


