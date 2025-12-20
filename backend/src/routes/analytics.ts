import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Детальна аналітика товарів
router.get('/products', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { period = '30', kiosk_id } = req.query;
    const periodDays = parseInt(String(period)) || 30;

    const params: any[] = [periodDays];
    if (kiosk_id) {
      params.push(kiosk_id);
    }

    // Аналітика по товарах: маржа, популярність, продажі
    const productsAnalytics = await query(`
      SELECT 
        p.id,
        p.name,
        p.brand,
        p.type,
        p.price,
        p.purchase_price,
        p.quantity,
        p.kiosk_id,
        k.name as kiosk_name,
        CASE 
          WHEN p.purchase_price > 0 THEN p.price - p.purchase_price
          ELSE NULL
        END as margin,
        CASE 
          WHEN p.purchase_price > 0 AND p.price > 0 THEN 
            ROUND(((p.price - p.purchase_price) / p.price * 100)::numeric, 2)
          ELSE NULL
        END as margin_percent,
        COALESCE(sales_stats.total_sales, 0) as total_sales,
        COALESCE(sales_stats.total_quantity_sold, 0) as total_quantity_sold,
        COALESCE(sales_stats.total_revenue, 0) as total_revenue,
        COALESCE(sales_stats.avg_daily_sales, 0) as avg_daily_sales,
        COALESCE(sales_stats.last_sale_date, NULL) as last_sale_date,
        CASE 
          WHEN COALESCE(sales_stats.total_sales, 0) = 0 THEN 'not_selling'
          WHEN COALESCE(sales_stats.total_sales, 0) < 5 THEN 'low_selling'
          WHEN COALESCE(sales_stats.total_sales, 0) < 20 THEN 'medium_selling'
          ELSE 'high_selling'
        END as popularity_status
      FROM products p
      LEFT JOIN kiosks k ON p.kiosk_id = k.id
      LEFT JOIN (
        SELECT 
          s.product_id,
          COUNT(*) as total_sales,
          SUM(s.quantity) as total_quantity_sold,
          SUM(s.price) as total_revenue,
          ROUND(COUNT(*)::numeric / NULLIF($1, 0), 2) as avg_daily_sales,
          MAX(s.created_at)::DATE as last_sale_date
        FROM sales s
        WHERE s.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
        ${kiosk_id ? `AND s.kiosk_id = $2` : ''}
        GROUP BY s.product_id
      ) sales_stats ON p.id = sales_stats.product_id
      WHERE 1=1
      ${kiosk_id ? `AND p.kiosk_id = $2` : ''}
      ORDER BY 
        COALESCE(sales_stats.total_revenue, 0) DESC,
        p.name ASC
    `, params);

    // Топ товарів за маржею
    const topMarginProducts = await query(`
      SELECT 
        p.id,
        p.name,
        p.price,
        p.purchase_price,
        (p.price - COALESCE(p.purchase_price, 0)) as margin,
        ROUND(((p.price - COALESCE(p.purchase_price, 0)) / NULLIF(p.price, 0) * 100)::numeric, 2) as margin_percent,
        COALESCE(SUM(s.price), 0) as total_revenue,
        COALESCE(SUM(s.quantity), 0) as total_quantity_sold
      FROM products p
      LEFT JOIN sales s ON p.id = s.product_id 
        AND s.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      WHERE p.purchase_price > 0
      ${kiosk_id ? `AND p.kiosk_id = $2` : ''}
      GROUP BY p.id, p.name, p.price, p.purchase_price
      HAVING (p.price - COALESCE(p.purchase_price, 0)) > 0
      ORDER BY margin_percent DESC
      LIMIT 10
    `, kiosk_id ? [periodDays, kiosk_id] : [periodDays]);

    // Товари, які не продаються
    const notSellingProducts = await query(`
      SELECT 
        p.id,
        p.name,
        p.brand,
        p.type,
        p.quantity,
        p.price,
        p.created_at,
        k.name as kiosk_name
      FROM products p
      LEFT JOIN kiosks k ON p.kiosk_id = k.id
      LEFT JOIN sales s ON p.id = s.product_id 
        AND s.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      WHERE s.id IS NULL
      ${kiosk_id ? `AND p.kiosk_id = $2` : ''}
      ORDER BY p.created_at DESC
      LIMIT 20
    `, kiosk_id ? [periodDays, kiosk_id] : [periodDays]);

    // Статистика по категоріях
    const categoryStats = await query(`
      SELECT 
        p.type,
        COUNT(DISTINCT p.id) as product_count,
        COALESCE(SUM(s.price), 0) as total_revenue,
        COALESCE(SUM(s.quantity), 0) as total_quantity_sold,
        COALESCE(COUNT(DISTINCT s.id), 0) as total_sales
      FROM products p
      LEFT JOIN sales s ON p.id = s.product_id 
        AND s.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      WHERE p.type IS NOT NULL
      ${kiosk_id ? `AND p.kiosk_id = $2` : ''}
      GROUP BY p.type
      ORDER BY total_revenue DESC
    `, kiosk_id ? [periodDays, kiosk_id] : [periodDays]);

    res.json({
      products: productsAnalytics.rows,
      top_margin: topMarginProducts.rows,
      not_selling: notSellingProducts.rows,
      categories: categoryStats.rows,
      period_days: periodDays,
    });
  } catch (error) {
    console.error('Products analytics error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

