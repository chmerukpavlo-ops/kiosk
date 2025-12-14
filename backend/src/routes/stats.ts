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

    // Today's expenses
    const expensesResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as expenses_today
       FROM expenses WHERE date = CURRENT_DATE`
    );

    // Today's purchase cost (from sold products)
    const purchaseCostResult = await query(
      `SELECT COALESCE(SUM(s.quantity * COALESCE(p.purchase_price, 0)), 0) as purchase_cost_today
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       WHERE DATE(s.created_at) = CURRENT_DATE`
    );

    // Today's sales count
    const salesCountResult = await query(
      `SELECT COUNT(*) as sales_today
       FROM sales WHERE DATE(created_at) = CURRENT_DATE`
    );

    // Sales chart data (last 30 days) with margin
    const chartResult = await query(
      `SELECT 
        DATE(s.created_at) as date,
        COUNT(*) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue,
        COALESCE(SUM(s.quantity * COALESCE(p.purchase_price, 0)), 0) as purchase_cost
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY DATE(s.created_at)
       ORDER BY date`
    );

    // Get expenses for chart
    const expensesChartResult = await query(
      `SELECT 
        date,
        COALESCE(SUM(amount), 0) as expenses
       FROM expenses
       WHERE date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY date
       ORDER BY date`
    );

    // Merge chart data with expenses and calculate margin
    const expensesMap = new Map(expensesChartResult.rows.map((r: any) => [r.date, parseFloat(r.expenses || '0')]));
    const chartWithMargin = chartResult.rows.map((row: any) => {
      const revenue = parseFloat(row.revenue || '0');
      const purchaseCost = parseFloat(row.purchase_cost || '0');
      const expenses = expensesMap.get(row.date) || 0;
      const margin = revenue - expenses - purchaseCost;
      return {
        ...row,
        expenses,
        margin,
        margin_percent: revenue > 0 ? (margin / revenue) * 100 : 0,
      };
    });

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
        COALESCE(SUM(s.price), 0) as revenue
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

    const revenue = parseFloat(revenueResult.rows[0]?.revenue_today || '0');
    const expenses = parseFloat(expensesResult.rows[0]?.expenses_today || '0');
    const purchaseCost = parseFloat(purchaseCostResult.rows[0]?.purchase_cost_today || '0');
    const margin = revenue - expenses - purchaseCost;
    const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;

    res.json({
      cards: {
        total_products: parseInt(productsResult.rows[0]?.total_quantity || '0'),
        revenue_today: revenue,
        sales_today: parseInt(salesCountResult.rows[0]?.sales_today || '0'),
        expenses_today: expenses,
        purchase_cost_today: purchaseCost,
        margin_today: margin,
        margin_percent_today: marginPercent,
      },
      chart: chartWithMargin,
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

