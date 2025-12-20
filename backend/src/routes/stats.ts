import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { getActiveReminders } from '../services/reminders.js';

const router = express.Router();

// Get dashboard stats (admin)
router.get('/dashboard', authenticate, requireAdmin, async (req: express.Request, res: express.Response) => {
  try {
    const { period = '30' } = req.query;
    const periodDays = parseInt(String(period)) || 30;
    
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
       FROM expenses WHERE date = CURRENT_DATE AND COALESCE(status, 'paid') = 'paid'`
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

    // Sales chart data with margin (based on period)
    const chartResult = await query(
      `SELECT 
        DATE(s.created_at) as date,
        COUNT(*) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue,
        COALESCE(SUM(s.quantity * COALESCE(p.purchase_price, 0)), 0) as purchase_cost
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
       GROUP BY DATE(s.created_at)
       ORDER BY date`
    );

    // Get expenses for chart
    const expensesChartResult = await query(
      `SELECT 
        date,
        COALESCE(SUM(amount), 0) as expenses
       FROM expenses
       WHERE date >= CURRENT_DATE - INTERVAL '${periodDays} days' AND COALESCE(status, 'paid') = 'paid'
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

    // Sales by product type (for pie chart)
    const salesByTypeResult = await query(
      `SELECT 
        COALESCE(p.type, 'Інше') as type,
        COUNT(*) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
       GROUP BY p.type
       ORDER BY revenue DESC
       LIMIT 10`
    );

    // Sales by hour of day (for bar chart)
    const salesByHourResult = await query(
      `SELECT 
        EXTRACT(HOUR FROM s.created_at) as hour,
        COUNT(*) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue
       FROM sales s
       WHERE s.created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
       GROUP BY EXTRACT(HOUR FROM s.created_at)
       ORDER BY hour`
    );

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
      sales_by_type: salesByTypeResult.rows,
      sales_by_hour: salesByHourResult.rows.map((r: any) => ({
        hour: parseInt(r.hour || '0'),
        sales_count: parseInt(r.sales_count || '0'),
        revenue: parseFloat(r.revenue || '0'),
      })),
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

// Get notifications/reminders (admin only)
router.get('/notifications', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const notifications: any[] = [];

    // 1. Overdue planned expenses (planned_for < CURRENT_DATE and status = 'planned')
    const overdueExpensesResult = await query(
      `SELECT e.*, k.name as kiosk_name
       FROM expenses e
       LEFT JOIN kiosks k ON e.kiosk_id = k.id
       WHERE e.status = 'planned' 
         AND e.planned_for IS NOT NULL 
         AND e.planned_for < CURRENT_DATE
       ORDER BY e.planned_for ASC
       LIMIT 10`
    );

    if (overdueExpensesResult.rows.length > 0) {
      notifications.push({
        type: 'overdue_expense',
        severity: 'high',
        title: 'Прострочені витрати',
        message: `У вас ${overdueExpensesResult.rows.length} прострочених запланованих витрат`,
        count: overdueExpensesResult.rows.length,
        items: overdueExpensesResult.rows.map((e: any) => ({
          id: e.id,
          description: e.description || 'Без опису',
          amount: parseFloat(e.amount || 0),
          planned_for: e.planned_for,
          kiosk_name: e.kiosk_name,
          category: e.category,
        })),
      });
    }

    // 2. Upcoming planned expenses (planned_for between CURRENT_DATE and CURRENT_DATE + 3 days)
    const upcomingExpensesResult = await query(
      `SELECT e.*, k.name as kiosk_name
       FROM expenses e
       LEFT JOIN kiosks k ON e.kiosk_id = k.id
       WHERE e.status = 'planned' 
         AND e.planned_for IS NOT NULL 
         AND e.planned_for >= CURRENT_DATE 
         AND e.planned_for <= CURRENT_DATE + INTERVAL '3 days'
       ORDER BY e.planned_for ASC
       LIMIT 10`
    );

    if (upcomingExpensesResult.rows.length > 0) {
      notifications.push({
        type: 'upcoming_expense',
        severity: 'medium',
        title: 'Майбутні витрати',
        message: `У вас ${upcomingExpensesResult.rows.length} витрат, які потрібно оплатити найближчими днями`,
        count: upcomingExpensesResult.rows.length,
        items: upcomingExpensesResult.rows.map((e: any) => ({
          id: e.id,
          description: e.description || 'Без опису',
          amount: parseFloat(e.amount || 0),
          planned_for: e.planned_for,
          kiosk_name: e.kiosk_name,
          category: e.category,
        })),
      });
    }

    // 3. Low stock alerts (using existing stock service)
    try {
      const lowStockResult = await query(
        `SELECT COUNT(*) as count
         FROM stock_alerts
         WHERE status = 'active'`
      );
      const lowStockCount = parseInt(lowStockResult.rows[0]?.count || '0');
      
      if (lowStockCount > 0) {
        notifications.push({
          type: 'low_stock',
          severity: 'medium',
          title: 'Низькі залишки',
          message: `У вас ${lowStockCount} товарів з низькими залишками`,
          count: lowStockCount,
          link: '/stock',
        });
      }
    } catch (e) {
      // Ignore stock check errors
    }

    // 4. Schedule reminders - незаповнені дні в поточному тижні
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Понеділок
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const scheduleResult = await query(
        `SELECT 
          COUNT(DISTINCT s.employee_id) as employees_with_shifts,
          COUNT(DISTINCT u.id) as total_employees
         FROM users u
         LEFT JOIN schedule s ON u.id = s.employee_id 
           AND s.date >= $1::date 
           AND s.date <= $2::date
         WHERE u.role = 'seller'`,
        [weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]
      );

      const employeesWithShifts = parseInt(scheduleResult.rows[0]?.employees_with_shifts || '0');
      const totalEmployees = parseInt(scheduleResult.rows[0]?.total_employees || '0');
      
      if (totalEmployees > 0 && employeesWithShifts < totalEmployees) {
        const missingEmployees = totalEmployees - employeesWithShifts;
        notifications.push({
          type: 'schedule',
          severity: 'low',
          title: 'Графік роботи',
          message: `У ${missingEmployees} з ${totalEmployees} продавців немає змін на цей тиждень`,
          count: missingEmployees,
          link: '/schedule',
        });
      }
    } catch (e) {
      // Ignore schedule check errors
      console.error('Schedule check error:', e);
    }

    res.json({
      notifications,
      total: notifications.length,
      unread_count: notifications.filter((n) => n.severity === 'high').length,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

