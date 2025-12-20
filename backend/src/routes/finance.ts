import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get financial report data (revenue, expenses, profit, margin)
router.get('/report', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { startDate, endDate, kiosk_id } = req.query;

    let dateFilter = '';
    const params: any[] = [];
    let paramCount = 1;

    if (startDate && endDate) {
      dateFilter = `DATE(created_at) >= $${paramCount} AND DATE(created_at) <= $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    } else {
      dateFilter = "DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)";
    }

    // Revenue
    let revenueSql = `SELECT COALESCE(SUM(price), 0) as revenue FROM sales WHERE ${dateFilter}`;
    const revenueParams: any[] = [];
    if (startDate && endDate) {
      revenueParams.push(startDate, endDate);
    }
    if (kiosk_id) {
      revenueSql += ` AND kiosk_id = $${revenueParams.length + 1}`;
      revenueParams.push(String(kiosk_id));
    }

    const revenueResult = await query(revenueSql, revenueParams);

    // Expenses
    let expensesDateFilter = '';
    let expensesParams: any[] = [];
    if (startDate && endDate) {
      expensesDateFilter = `date >= $1 AND date <= $2`;
      expensesParams.push(startDate, endDate);
    } else {
      expensesDateFilter = "date >= DATE_TRUNC('month', CURRENT_DATE)";
    }

    let expensesSql = `SELECT COALESCE(SUM(amount), 0) as expenses FROM expenses WHERE ${expensesDateFilter} AND COALESCE(status, 'paid') = 'paid'`;
    if (kiosk_id) {
      expensesSql += ` AND kiosk_id = $${expensesParams.length + 1}`;
      expensesParams.push(String(kiosk_id));
    }

    const expensesResult = await query(expensesSql, expensesParams);

    // Purchase cost
    let purchaseCostSql = `SELECT COALESCE(SUM(s.quantity * COALESCE(p.purchase_price, 0)), 0) as purchase_cost
                          FROM sales s
                          LEFT JOIN products p ON s.product_id = p.id
                          WHERE ${dateFilter}`;
    const purchaseParams: any[] = [];
    if (startDate && endDate) {
      purchaseParams.push(startDate, endDate);
    }
    if (kiosk_id) {
      purchaseCostSql += ` AND s.kiosk_id = $${purchaseParams.length + 1}`;
      purchaseParams.push(String(kiosk_id));
    }

    const purchaseCostResult = await query(purchaseCostSql, purchaseParams);

    const revenue = parseFloat(revenueResult.rows[0]?.revenue || '0');
    const expenses = parseFloat(expensesResult.rows[0]?.expenses || '0');
    const purchaseCost = parseFloat(purchaseCostResult.rows[0]?.purchase_cost || '0');
    const profit = revenue - expenses - purchaseCost;
    const margin = revenue - purchaseCost;
    const marginPercent = revenue > 0 ? (margin / revenue) * 100 : 0;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    res.json({
      revenue,
      expenses,
      purchase_cost: purchaseCost,
      margin,
      margin_percent: marginPercent,
      profit,
      profit_margin: profitMargin,
    });
  } catch (error) {
    console.error('Get financial report error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get period comparison
router.get('/comparison', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { period = 'month', kiosk_id } = req.query;

    let currentStart = '';
    let currentEnd = '';
    let previousStart = '';
    let previousEnd = '';

    if (period === 'month') {
      currentStart = "DATE_TRUNC('month', CURRENT_DATE)";
      currentEnd = "DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'";
      previousStart = "DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'";
      previousEnd = "DATE_TRUNC('month', CURRENT_DATE)";
    } else if (period === 'week') {
      currentStart = "CURRENT_DATE - INTERVAL '7 days'";
      currentEnd = "CURRENT_DATE";
      previousStart = "CURRENT_DATE - INTERVAL '14 days'";
      previousEnd = "CURRENT_DATE - INTERVAL '7 days'";
    }

    const params: any[] = [];
    let paramCount = 1;

    // Current period revenue
    let currentRevenueSql = `SELECT COALESCE(SUM(price), 0) as revenue 
                            FROM sales 
                            WHERE DATE(created_at) >= ${currentStart} AND DATE(created_at) < ${currentEnd}`;
    if (kiosk_id) {
      currentRevenueSql += ` AND kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    const currentRevenueResult = await query(currentRevenueSql, kiosk_id ? params : []);

    // Previous period revenue
    let previousRevenueSql = `SELECT COALESCE(SUM(price), 0) as revenue 
                             FROM sales 
                             WHERE DATE(created_at) >= ${previousStart} AND DATE(created_at) < ${previousEnd}`;
    if (kiosk_id) {
      previousRevenueSql += ` AND kiosk_id = $1`;
    }

    const previousRevenueResult = await query(previousRevenueSql, kiosk_id ? [String(kiosk_id)] : []);

    // Current period expenses
    let currentExpensesSql = `SELECT COALESCE(SUM(amount), 0) as expenses 
                             FROM expenses 
                             WHERE date >= ${currentStart} AND date < ${currentEnd} AND COALESCE(status, 'paid') = 'paid'`;
    if (kiosk_id) {
      currentExpensesSql += ` AND kiosk_id = $${paramCount}`;
      params.push(String(kiosk_id));
      paramCount++;
    }

    const currentExpensesResult = await query(currentExpensesSql, kiosk_id ? params : []);

    // Previous period expenses
    let previousExpensesSql = `SELECT COALESCE(SUM(amount), 0) as expenses 
                              FROM expenses 
                              WHERE date >= ${previousStart} AND date < ${previousEnd} AND COALESCE(status, 'paid') = 'paid'`;
    if (kiosk_id) {
      previousExpensesSql += ` AND kiosk_id = $1`;
    }

    const previousExpensesResult = await query(previousExpensesSql, kiosk_id ? [String(kiosk_id)] : []);

    const currentRevenue = parseFloat(currentRevenueResult.rows[0]?.revenue || '0');
    const previousRevenue = parseFloat(previousRevenueResult.rows[0]?.revenue || '0');
    const currentExpenses = parseFloat(currentExpensesResult.rows[0]?.expenses || '0');
    const previousExpenses = parseFloat(previousExpensesResult.rows[0]?.expenses || '0');

    const revenueChange = currentRevenue - previousRevenue;
    const revenuePercentChange = previousRevenue > 0 ? (revenueChange / previousRevenue) * 100 : 0;
    const expensesChange = currentExpenses - previousExpenses;
    const expensesPercentChange = previousExpenses > 0 ? (expensesChange / previousExpenses) * 100 : 0;

    res.json({
      revenue: {
        current: currentRevenue,
        previous: previousRevenue,
        change: revenueChange,
        percent_change: revenuePercentChange,
      },
      expenses: {
        current: currentExpenses,
        previous: previousExpenses,
        change: expensesChange,
        percent_change: expensesPercentChange,
      },
    });
  } catch (error) {
    console.error('Get period comparison error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get profit forecast for next month
router.get('/forecast', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id } = req.query;

    // Get last 3 months of data for trend analysis
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const startDate = threeMonthsAgo.toISOString().split('T')[0];

    const params: any[] = [];
    let paramCount = 1;

    // Revenue trend (last 3 months)
    let revenueSql = `SELECT 
      DATE_TRUNC('month', created_at) as month,
      COALESCE(SUM(price), 0) as revenue
    FROM sales 
    WHERE DATE(created_at) >= $${paramCount}`;
    params.push(startDate);
    paramCount++;

    if (kiosk_id) {
      revenueSql += ` AND kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    revenueSql += ` GROUP BY DATE_TRUNC('month', created_at) ORDER BY month`;

    const revenueResult = await query(revenueSql, params.slice(0, paramCount - (kiosk_id ? 1 : 0)));

    // Expenses trend (last 3 months)
    let expensesSql = `SELECT 
      DATE_TRUNC('month', date) as month,
      COALESCE(SUM(amount), 0) as expenses
    FROM expenses 
    WHERE date >= $1 AND COALESCE(status, 'paid') = 'paid'`;
    const expensesParams = [startDate];
    if (kiosk_id) {
      expensesSql += ` AND kiosk_id = $2`;
      expensesParams.push(String(kiosk_id));
    }
    expensesSql += ` GROUP BY DATE_TRUNC('month', date) ORDER BY month`;

    const expensesResult = await query(expensesSql, expensesParams);

    // Calculate average monthly growth rate
    const revenueData = revenueResult.rows.map((r: any) => ({
      month: r.month,
      revenue: parseFloat(r.revenue || '0'),
    }));

    const expensesData = expensesResult.rows.map((r: any) => ({
      month: r.month,
      expenses: parseFloat(r.expenses || '0'),
    }));

    // Simple linear regression for forecast
    let revenueGrowth = 0;
    let expensesGrowth = 0;

    if (revenueData.length >= 2) {
      const recentRevenue = revenueData.slice(-2);
      revenueGrowth = recentRevenue[1].revenue > 0 && recentRevenue[0].revenue > 0
        ? ((revenueData[revenueData.length - 1].revenue - recentRevenue[0].revenue) / recentRevenue[0].revenue) * 100
        : 0;
    }

    if (expensesData.length >= 2) {
      const recentExpenses = expensesData.slice(-2);
      expensesGrowth = recentExpenses[1].expenses > 0 && recentExpenses[0].expenses > 0
        ? ((expensesData[expensesData.length - 1].expenses - recentExpenses[0].expenses) / recentExpenses[0].expenses) * 100
        : 0;
    }

    // Current month data
    const currentMonthRevenue = revenueData.length > 0 ? revenueData[revenueData.length - 1].revenue : 0;
    const currentMonthExpenses = expensesData.length > 0 ? expensesData[expensesData.length - 1].expenses : 0;

    // Forecast for next month (using average growth or last month if no trend)
    const forecastRevenue = currentMonthRevenue > 0
      ? currentMonthRevenue * (1 + revenueGrowth / 100)
      : currentMonthRevenue;
    const forecastExpenses = currentMonthExpenses > 0
      ? currentMonthExpenses * (1 + expensesGrowth / 100)
      : currentMonthExpenses;

    // Get average purchase cost (last month)
    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);
    const lastMonthEnd = new Date();
    lastMonthEnd.setDate(0);

    let purchaseCostSql = `SELECT COALESCE(SUM(s.quantity * COALESCE(p.purchase_price, 0)), 0) as purchase_cost
                          FROM sales s
                          LEFT JOIN products p ON s.product_id = p.id
                          WHERE DATE(s.created_at) >= $1 AND DATE(s.created_at) <= $2`;
    const purchaseParams = [lastMonthStart.toISOString().split('T')[0], lastMonthEnd.toISOString().split('T')[0]];
    if (kiosk_id) {
      purchaseCostSql += ` AND s.kiosk_id = $3`;
      purchaseParams.push(String(kiosk_id));
    }

    const purchaseCostResult = await query(purchaseCostSql, purchaseParams);
    const avgPurchaseCost = parseFloat(purchaseCostResult.rows[0]?.purchase_cost || '0');

    const forecastProfit = forecastRevenue - forecastExpenses - avgPurchaseCost;
    const forecastMargin = forecastRevenue - avgPurchaseCost;
    const forecastMarginPercent = forecastRevenue > 0 ? (forecastMargin / forecastRevenue) * 100 : 0;

    res.json({
      forecast: {
        revenue: forecastRevenue,
        expenses: forecastExpenses,
        purchase_cost: avgPurchaseCost,
        profit: forecastProfit,
        margin: forecastMargin,
        margin_percent: forecastMarginPercent,
      },
      trends: {
        revenue_growth: revenueGrowth,
        expenses_growth: expensesGrowth,
      },
      current_month: {
        revenue: currentMonthRevenue,
        expenses: currentMonthExpenses,
      },
    });
  } catch (error) {
    console.error('Get forecast error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get optimization recommendations
router.get('/recommendations', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id } = req.query;
    const recommendations: any[] = [];

    const params: any[] = [];
    let paramCount = 1;

    // Check for high expenses this month
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    let expensesSql = `SELECT 
      category,
      SUM(amount) as total,
      COUNT(*) as count
    FROM expenses 
    WHERE date >= $${paramCount} AND COALESCE(status, 'paid') = 'paid'`;
    params.push(currentMonthStart.toISOString().split('T')[0]);
    paramCount++;

    if (kiosk_id) {
      expensesSql += ` AND kiosk_id = $${paramCount}`;
      params.push(String(kiosk_id));
      paramCount++;
    }

    expensesSql += ` GROUP BY category ORDER BY total DESC`;

    const expensesResult = await query(expensesSql, params.slice(0, paramCount - (kiosk_id ? 1 : 0)));

    // Get last month expenses for comparison
    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);
    const lastMonthEnd = new Date();
    lastMonthEnd.setDate(0);

    let lastMonthExpensesSql = `SELECT 
      category,
      SUM(amount) as total
    FROM expenses 
    WHERE date >= $1 AND date <= $2 AND COALESCE(status, 'paid') = 'paid'`;
    const lastMonthParams = [lastMonthStart.toISOString().split('T')[0], lastMonthEnd.toISOString().split('T')[0]];
    if (kiosk_id) {
      lastMonthExpensesSql += ` AND kiosk_id = $3`;
      lastMonthParams.push(String(kiosk_id));
    }
    lastMonthExpensesSql += ` GROUP BY category`;

    const lastMonthExpensesResult = await query(lastMonthExpensesSql, lastMonthParams);
    const lastMonthExpensesMap = new Map(
      lastMonthExpensesResult.rows.map((r: any) => [r.category, parseFloat(r.total || '0')])
    );

    // Analyze expenses
    expensesResult.rows.forEach((row: any) => {
      const currentTotal = parseFloat(row.total || '0');
      const lastMonthTotal = lastMonthExpensesMap.get(row.category) || 0;
      const increase = lastMonthTotal > 0 ? ((currentTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

      if (increase > 20 && currentTotal > 1000) {
        recommendations.push({
          type: 'expense_increase',
          category: row.category,
          severity: increase > 50 ? 'high' : 'medium',
          message: `Витрати на "${CATEGORY_LABELS[row.category] || row.category}" зросли на ${increase.toFixed(1)}% порівняно з минулим місяцем (${currentTotal.toFixed(2)} ₴). Рекомендується перевірити обґрунтованість цих витрат.`,
          current_amount: currentTotal,
          previous_amount: lastMonthTotal,
          increase_percent: increase,
        });
      }
    });

    // Check for low margin products
    let productsSql = `SELECT 
      p.id,
      p.name,
      p.price,
      p.purchase_price,
      p.quantity,
      (p.price - COALESCE(p.purchase_price, 0)) as margin,
      CASE 
        WHEN p.price > 0 THEN ((p.price - COALESCE(p.purchase_price, 0)) / p.price * 100)
        ELSE 0
      END as margin_percent
    FROM products p
    WHERE p.quantity > 0 AND p.status = 'available'`;
    
    const productsParams: any[] = [];
    let productsParamCount = 1;

    if (kiosk_id) {
      productsSql += ` AND p.kiosk_id = $${productsParamCount}`;
      productsParams.push(String(kiosk_id));
      productsParamCount++;
    }

    productsSql += ` HAVING (p.price - COALESCE(p.purchase_price, 0)) / NULLIF(p.price, 0) * 100 < 15
                     ORDER BY margin_percent ASC
                     LIMIT 10`;

    const lowMarginProducts = await query(productsSql, productsParams);

    if (lowMarginProducts.rows.length > 0) {
      recommendations.push({
        type: 'low_margin',
        severity: 'medium',
        message: `Знайдено ${lowMarginProducts.rows.length} товарів з низькою маржею (<15%). Рекомендується переглянути ціни або собівартість.`,
        products: lowMarginProducts.rows.map((p: any) => ({
          id: p.id,
          name: p.name,
          margin_percent: parseFloat(p.margin_percent || '0'),
          margin: parseFloat(p.margin || '0'),
        })),
      });
    }

    // Check for out of stock products
    let outOfStockSql = `SELECT COUNT(*) as count FROM products WHERE quantity = 0 OR status = 'out_of_stock'`;
    const outOfStockParams: any[] = [];
    let outOfStockParamCount = 1;

    if (kiosk_id) {
      outOfStockSql += ` AND kiosk_id = $${outOfStockParamCount}`;
      outOfStockParams.push(String(kiosk_id));
    }

    const outOfStockResult = await query(outOfStockSql, outOfStockParams);
    const outOfStockCount = parseInt(outOfStockResult.rows[0]?.count || '0');

    if (outOfStockCount > 5) {
      recommendations.push({
        type: 'out_of_stock',
        severity: 'high',
        message: `${outOfStockCount} товарів відсутні в наявності. Рекомендується поповнити склад.`,
        count: outOfStockCount,
      });
    }

    // Check for products with low quantity
    let lowQuantitySql = `SELECT COUNT(*) as count FROM products WHERE quantity > 0 AND quantity < 5 AND status = 'available'`;
    const lowQuantityParams: any[] = [];
    let lowQuantityParamCount = 1;

    if (kiosk_id) {
      lowQuantitySql += ` AND kiosk_id = $${lowQuantityParamCount}`;
      lowQuantityParams.push(String(kiosk_id));
    }

    const lowQuantityResult = await query(lowQuantitySql, lowQuantityParams);
    const lowQuantityCount = parseInt(lowQuantityResult.rows[0]?.count || '0');

    if (lowQuantityCount > 10) {
      recommendations.push({
        type: 'low_quantity',
        severity: 'medium',
        message: `${lowQuantityCount} товарів мають низькі залишки (<5 шт.). Рекомендується поповнити склад.`,
        count: lowQuantityCount,
      });
    }

    res.json({
      recommendations: recommendations.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder];
      }),
      total: recommendations.length,
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Оренда',
  purchase: 'Закупівля',
  utilities: 'Комунальні',
  advertising: 'Реклама',
  salary: 'Зарплата',
  other: 'Інше',
};

export default router;

