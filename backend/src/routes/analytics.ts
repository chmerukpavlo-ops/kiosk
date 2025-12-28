import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get sales trends and predictions
router.get('/trends', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { period = '30', kiosk_id } = req.query;
    const periodDays = parseInt(String(period)) || 30;

    // Daily sales trend for the period
    const dailySalesResult = await query(
      `SELECT 
        DATE(s.created_at) as date,
        COUNT(*) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue,
        COALESCE(SUM(s.quantity), 0) as quantity_sold
      FROM sales s
      WHERE s.created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
        ${kiosk_id ? `AND s.kiosk_id = ${parseInt(String(kiosk_id))}` : ''}
      GROUP BY DATE(s.created_at)
      ORDER BY date`
    );

    // Calculate trend (simple linear regression)
    const dailyData = dailySalesResult.rows;
    let trend = 0;
    if (dailyData.length > 1) {
      const n = dailyData.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;

      dailyData.forEach((row: any, index: number) => {
        const x = index;
        const y = parseFloat(row.revenue || 0);
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      });

      trend = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    // Predict next 7 days
    const lastRevenue = dailyData.length > 0 
      ? parseFloat(dailyData[dailyData.length - 1].revenue || 0)
      : 0;
    const predictions = [];
    for (let i = 1; i <= 7; i++) {
      const predictedRevenue = Math.max(0, lastRevenue + trend * i);
      predictions.push({
        day: i,
        predicted_revenue: predictedRevenue,
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }

    // Product performance
    const productPerformanceResult = await query(
      `SELECT 
        p.id,
        p.name,
        p.brand,
        p.type,
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.quantity), 0) as total_quantity_sold,
        COALESCE(SUM(s.price), 0) as total_revenue,
        AVG(s.price) as avg_price
      FROM products p
      LEFT JOIN sales s ON p.id = s.product_id 
        AND s.created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
      GROUP BY p.id, p.name, p.brand, p.type
      HAVING COUNT(s.id) > 0
      ORDER BY total_revenue DESC
      LIMIT 20`
    );

    // Hourly sales pattern
    const hourlyPatternResult = await query(
      `SELECT 
        EXTRACT(HOUR FROM s.created_at) as hour,
        COUNT(*) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue
      FROM sales s
      WHERE s.created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
        ${kiosk_id ? `AND s.kiosk_id = ${parseInt(String(kiosk_id))}` : ''}
      GROUP BY EXTRACT(HOUR FROM s.created_at)
      ORDER BY hour`
    );

    // Day of week pattern
    const dayOfWeekPatternResult = await query(
      `SELECT 
        EXTRACT(DOW FROM s.created_at) as day_of_week,
        TO_CHAR(s.created_at, 'Day') as day_name,
        COUNT(*) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue
      FROM sales s
      WHERE s.created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
        ${kiosk_id ? `AND s.kiosk_id = ${parseInt(String(kiosk_id))}` : ''}
      GROUP BY EXTRACT(DOW FROM s.created_at), TO_CHAR(s.created_at, 'Day')
      ORDER BY day_of_week`
    );

    // Growth metrics
    const currentPeriodRevenue = dailyData.reduce((sum: number, row: any) => 
      sum + parseFloat(row.revenue || 0), 0
    );
    
    const previousPeriodStart = new Date();
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays * 2);
    const previousPeriodEnd = new Date();
    previousPeriodEnd.setDate(previousPeriodEnd.getDate() - periodDays);

    const previousPeriodResult = await query(
      `SELECT COALESCE(SUM(price), 0) as revenue
       FROM sales
       WHERE created_at >= $1 AND created_at < $2
         ${kiosk_id ? `AND kiosk_id = ${parseInt(String(kiosk_id))}` : ''}`,
      [previousPeriodStart.toISOString().split('T')[0], previousPeriodEnd.toISOString().split('T')[0]]
    );

    const previousPeriodRevenue = parseFloat(previousPeriodResult.rows[0]?.revenue || 0);
    const growthPercent = previousPeriodRevenue > 0
      ? ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : 0;

    res.json({
      daily_trend: dailyData,
      trend_slope: trend,
      predictions,
      product_performance: productPerformanceResult.rows,
      hourly_pattern: hourlyPatternResult.rows,
      day_of_week_pattern: dayOfWeekPatternResult.rows,
      growth: {
        current_period: currentPeriodRevenue,
        previous_period: previousPeriodRevenue,
        growth_percent: growthPercent,
      },
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get sales forecast
router.get('/forecast', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { days = '7', kiosk_id } = req.query;
    const forecastDays = parseInt(String(days)) || 7;

    // Get historical data (last 30 days)
    const historicalResult = await query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as sales_count,
        COALESCE(SUM(price), 0) as revenue,
        COALESCE(SUM(quantity), 0) as quantity
      FROM sales
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        ${kiosk_id ? `AND kiosk_id = ${parseInt(String(kiosk_id))}` : ''}
      GROUP BY DATE(created_at)
      ORDER BY date`
    );

    const historical = historicalResult.rows;

    // Simple moving average forecast
    const window = Math.min(7, historical.length);
    const recentRevenue = historical.slice(-window).map((row: any) => parseFloat(row.revenue || 0));
    const avgRevenue = recentRevenue.length > 0
      ? recentRevenue.reduce((a, b) => a + b, 0) / recentRevenue.length
      : 0;

    // Calculate trend
    let trend = 0;
    if (historical.length > 1) {
      const n = historical.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumX2 = 0;

      historical.forEach((row: any, index: number) => {
        const x = index;
        const y = parseFloat(row.revenue || 0);
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      });

      trend = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    // Generate forecast
    const forecast = [];
    for (let i = 1; i <= forecastDays; i++) {
      const baseRevenue = avgRevenue;
      const trendAdjustment = trend * i;
      const predictedRevenue = Math.max(0, baseRevenue + trendAdjustment);
      
      // Add some variance based on day of week
      const dayOfWeek = (new Date().getDay() + i) % 7;
      const dayMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.8 : 1.1; // Weekend vs weekday
      
      forecast.push({
        date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predicted_revenue: predictedRevenue * dayMultiplier,
        predicted_sales_count: Math.round((predictedRevenue * dayMultiplier) / (avgRevenue / (historical.length > 0 ? parseFloat(historical[historical.length - 1].sales_count || 1) : 1))),
        confidence: Math.max(0.5, 1 - (i * 0.1)), // Decreasing confidence for further days
      });
    }

    res.json({
      historical,
      forecast,
      metrics: {
        average_daily_revenue: avgRevenue,
        trend: trend,
        trend_direction: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
      },
    });
  } catch (error) {
    console.error('Get forecast error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get category/brand analysis
router.get('/categories', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { period = '30', kiosk_id } = req.query;
    const periodDays = parseInt(String(period)) || 30;

    // Category performance
    const categoryResult = await query(
      `SELECT 
        p.type as category,
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue,
        COALESCE(SUM(s.quantity), 0) as quantity_sold,
        AVG(s.price) as avg_price
      FROM products p
      JOIN sales s ON p.id = s.product_id
      WHERE s.created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
        ${kiosk_id ? `AND s.kiosk_id = ${parseInt(String(kiosk_id))}` : ''}
      GROUP BY p.type
      ORDER BY revenue DESC`
    );

    // Brand performance
    const brandResult = await query(
      `SELECT 
        p.brand,
        COUNT(s.id) as sales_count,
        COALESCE(SUM(s.price), 0) as revenue,
        COALESCE(SUM(s.quantity), 0) as quantity_sold,
        AVG(s.price) as avg_price
      FROM products p
      JOIN sales s ON p.id = s.product_id
      WHERE s.created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'
        AND p.brand IS NOT NULL
        ${kiosk_id ? `AND s.kiosk_id = ${parseInt(String(kiosk_id))}` : ''}
      GROUP BY p.brand
      ORDER BY revenue DESC
      LIMIT 20`
    );

    res.json({
      categories: categoryResult.rows,
      brands: brandResult.rows,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;
