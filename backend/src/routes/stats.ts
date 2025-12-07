import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard stats (admin)
router.get('/dashboard', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    // Total products quantity
    const productsResult = await query('SELECT SUM(quantity) as total_quantity FROM products');
    
    // Today's revenue
    const revenueResult = await query(
      `SELECT COALESCE(SUM(price), 0) as revenue_today
       FROM sales WHERE DATE(created_at) = CURRENT_DATE`
    );

    // Today's commission
    const commissionResult = await query(
      `SELECT COALESCE(SUM(commission), 0) as commission_today
       FROM sales WHERE DATE(created_at) = CURRENT_DATE`
    );

    // Today's sales count
    const salesCountResult = await query(
      `SELECT COUNT(*) as sales_today
       FROM sales WHERE DATE(created_at) = CURRENT_DATE`
    );

    // Sales chart data (last 30 days)
    const chartResult = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as sales_count,
        COALESCE(SUM(price), 0) as revenue
       FROM sales
       WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // Recent sales (last 20)
    const recentSalesResult = await query(
      `SELECT s.*, 
              p.name as product_name,
              u.full_name as seller_name,
              k.name as kiosk_name
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       LEFT JOIN users u ON s.seller_id = u.id
       LEFT JOIN kiosks k ON s.kiosk_id = k.id
       ORDER BY s.created_at DESC
       LIMIT 20`
    );

    // Top sellers (by sales count today)
    const topSellersResult = await query(
      `SELECT 
        u.id,
        u.full_name,
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue,
        COALESCE(SUM(s.commission), 0) as commission
       FROM users u
       LEFT JOIN sales s ON u.id = s.seller_id AND DATE(s.created_at) = CURRENT_DATE
       WHERE u.role = 'seller'
       GROUP BY u.id, u.full_name
       ORDER BY sales_count DESC
       LIMIT 10`
    );

    // Top products (by sales count today)
    const topProductsResult = await query(
      `SELECT 
        p.id,
        p.name,
        p.brand,
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue
       FROM products p
       LEFT JOIN sales s ON p.id = s.product_id AND DATE(s.created_at) = CURRENT_DATE
       GROUP BY p.id, p.name, p.brand
       ORDER BY sales_count DESC
       LIMIT 10`
    );

    res.json({
      cards: {
        total_products: parseInt(productsResult.rows[0]?.total_quantity || '0'),
        revenue_today: parseFloat(revenueResult.rows[0]?.revenue_today || '0'),
        commission_today: parseFloat(commissionResult.rows[0]?.commission_today || '0'),
        sales_today: parseInt(salesCountResult.rows[0]?.sales_today || '0'),
      },
      chart: chartResult.rows,
      recent_sales: recentSalesResult.rows,
      top_sellers: topSellersResult.rows,
      top_products: topProductsResult.rows,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get seller dashboard stats
router.get('/seller', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.user!.id;
    const kioskId = req.user!.kiosk_id;

    if (!userId) {
      return res.status(401).json({ error: 'Не авторизовано' });
    }

    // Products in kiosk
    const productsResult = await query(
      'SELECT COUNT(*) as total, SUM(quantity) as total_quantity FROM products WHERE kiosk_id = $1',
      [kioskId]
    );

    // Today's revenue
    const revenueResult = await query(
      `SELECT COALESCE(SUM(price), 0) as revenue_today
       FROM sales WHERE seller_id = $1 AND DATE(created_at) = CURRENT_DATE`,
      [userId]
    );

    // Today's commission
    const commissionResult = await query(
      `SELECT COALESCE(SUM(commission), 0) as commission_today
       FROM sales WHERE seller_id = $1 AND DATE(created_at) = CURRENT_DATE`,
      [userId]
    );

    // Available products
    const availableProductsResult = await query(
      'SELECT * FROM products WHERE kiosk_id = $1 AND quantity > 0 ORDER BY name',
      [kioskId]
    );

    // Recent sales
    const recentSalesResult = await query(
      `SELECT s.*, p.name as product_name
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       WHERE s.seller_id = $1
       ORDER BY s.created_at DESC
       LIMIT 20`,
      [userId]
    );

    res.json({
      cards: {
        total_products: parseInt(productsResult.rows[0]?.total || '0'),
        total_quantity: parseInt(productsResult.rows[0]?.total_quantity || '0'),
        revenue_today: parseFloat(revenueResult.rows[0]?.revenue_today || '0'),
        commission_today: parseFloat(commissionResult.rows[0]?.commission_today || '0'),
      },
      products: availableProductsResult.rows,
      recent_sales: recentSalesResult.rows,
    });
  } catch (error) {
    console.error('Get seller stats error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

