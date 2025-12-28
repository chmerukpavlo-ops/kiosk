import express from 'express';
import { query } from '../db/init.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get product recommendations based on sales history
router.get('/products', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { product_id, kiosk_id, limit = 5 } = req.query;
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    // Get user's kiosk if not admin
    let userKioskId = null;
    if (!isAdmin && userId) {
      const userResult = await query('SELECT kiosk_id FROM users WHERE id = $1', [userId]);
      userKioskId = userResult.rows[0]?.kiosk_id;
    }

    const recommendations: any[] = [];

    // 1. Popular products (most sold in last 30 days)
    const popularProductsResult = await query(
      `SELECT 
        p.id,
        p.name,
        p.brand,
        p.type,
        p.price,
        p.quantity,
        p.discount_percent,
        p.discount_start_date,
        p.discount_end_date,
        COUNT(s.id) as sales_count,
        SUM(s.quantity) as total_quantity_sold,
        COALESCE(SUM(s.price), 0) as total_revenue
      FROM products p
      LEFT JOIN sales s ON p.id = s.product_id 
        AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
      WHERE p.quantity > 0
        ${userKioskId ? 'AND p.kiosk_id = $1' : ''}
        ${isAdmin && kiosk_id ? 'AND p.kiosk_id = $1' : ''}
      GROUP BY p.id, p.name, p.brand, p.type, p.price, p.quantity, p.discount_percent, p.discount_start_date, p.discount_end_date
      HAVING COUNT(s.id) > 0
      ORDER BY sales_count DESC, total_revenue DESC
      LIMIT $${userKioskId || (isAdmin && kiosk_id) ? '2' : '1'}::int`,
      userKioskId || (isAdmin && kiosk_id) 
        ? [userKioskId || kiosk_id, parseInt(String(limit))]
        : [parseInt(String(limit))]
    );

    recommendations.push(...popularProductsResult.rows.map((p: any) => ({
      ...p,
      reason: 'Популярний товар',
      score: parseFloat(p.sales_count || 0),
    })));

    // 2. Frequently bought together (if product_id provided)
    if (product_id) {
      const productIdNum = parseInt(String(product_id));
      
      // Find products that are often sold in the same transaction (same created_at, same seller)
      const coPurchasedResult = await query(
        `SELECT 
          p2.id,
          p2.name,
          p2.brand,
          p2.type,
          p2.price,
          p2.quantity,
          p2.discount_percent,
          p2.discount_start_date,
          p2.discount_end_date,
          COUNT(DISTINCT s1.created_at::date || s1.seller_id) as co_purchase_count
        FROM sales s1
        JOIN sales s2 ON 
          DATE(s1.created_at) = DATE(s2.created_at) 
          AND s1.seller_id = s2.seller_id
          AND s1.id != s2.id
        JOIN products p2 ON s2.product_id = p2.id
        WHERE s1.product_id = $1
          AND p2.id != $1
          AND p2.quantity > 0
          AND s1.created_at >= CURRENT_DATE - INTERVAL '90 days'
          ${userKioskId ? 'AND p2.kiosk_id = $2' : ''}
        GROUP BY p2.id, p2.name, p2.brand, p2.type, p2.price, p2.quantity, p2.discount_percent, p2.discount_start_date, p2.discount_end_date
        ORDER BY co_purchase_count DESC
        LIMIT $${userKioskId ? '3' : '2'}::int`,
        userKioskId 
          ? [productIdNum, userKioskId, parseInt(String(limit))]
          : [productIdNum, parseInt(String(limit))]
      );

      recommendations.push(...coPurchasedResult.rows.map((p: any) => ({
        ...p,
        reason: 'Часто купують разом',
        score: parseFloat(p.co_purchase_count || 0),
      })));
    }

    // 3. Same category/type products (if product_id provided)
    if (product_id) {
      const productIdNum = parseInt(String(product_id));
      
      // Get product type
      const productResult = await query('SELECT type FROM products WHERE id = $1', [productIdNum]);
      const productType = productResult.rows[0]?.type;

      if (productType) {
        const sameTypeResult = await query(
          `SELECT 
            p.id,
            p.name,
            p.brand,
            p.type,
            p.price,
            p.quantity,
            p.discount_percent,
            p.discount_start_date,
            p.discount_end_date,
            COUNT(s.id) as sales_count
          FROM products p
          LEFT JOIN sales s ON p.id = s.product_id 
            AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
          WHERE p.type = $1
            AND p.id != $2
            AND p.quantity > 0
            ${userKioskId ? 'AND p.kiosk_id = $3' : ''}
          GROUP BY p.id, p.name, p.brand, p.type, p.price, p.quantity, p.discount_percent, p.discount_start_date, p.discount_end_date
          ORDER BY sales_count DESC, p.name
          LIMIT $${userKioskId ? '4' : '3'}::int`,
          userKioskId 
            ? [productType, productIdNum, userKioskId, parseInt(String(limit))]
            : [productType, productIdNum, parseInt(String(limit))]
        );

        recommendations.push(...sameTypeResult.rows.map((p: any) => ({
          ...p,
          reason: `Також ${productType}`,
          score: parseFloat(p.sales_count || 0),
        })));
      }
    }

    // 4. Recently sold products (last 7 days)
    const recentResult = await query(
      `SELECT DISTINCT
        p.id,
        p.name,
        p.brand,
        p.type,
        p.price,
        p.quantity,
        p.discount_percent,
        p.discount_start_date,
        p.discount_end_date,
        MAX(s.created_at) as last_sold
      FROM products p
      JOIN sales s ON p.id = s.product_id
      WHERE s.created_at >= CURRENT_DATE - INTERVAL '7 days'
        AND p.quantity > 0
        ${userKioskId ? 'AND p.kiosk_id = $1' : ''}
        ${product_id ? `AND p.id != $${userKioskId ? '2' : '1'}::int` : ''}
      GROUP BY p.id, p.name, p.brand, p.type, p.price, p.quantity, p.discount_percent, p.discount_start_date, p.discount_end_date
      ORDER BY last_sold DESC
      LIMIT $${userKioskId || product_id ? (userKioskId && product_id ? '3' : '2') : '1'}::int`,
      userKioskId && product_id
        ? [userKioskId, parseInt(String(product_id)), parseInt(String(limit))]
        : userKioskId || product_id
        ? [userKioskId || parseInt(String(product_id)), parseInt(String(limit))]
        : [parseInt(String(limit))]
    );

    recommendations.push(...recentResult.rows.map((p: any) => ({
      ...p,
      reason: 'Недавно продавався',
      score: 1,
    })));

    // Remove duplicates and sort by score
    const uniqueRecommendations = new Map();
    recommendations.forEach((rec) => {
      if (!uniqueRecommendations.has(rec.id)) {
        uniqueRecommendations.set(rec.id, rec);
      } else {
        // Update score if higher
        const existing = uniqueRecommendations.get(rec.id);
        if (rec.score > existing.score) {
          uniqueRecommendations.set(rec.id, rec);
        }
      }
    });

    // Sort by score and limit
    const sortedRecommendations = Array.from(uniqueRecommendations.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, parseInt(String(limit)));

    // Calculate final price with discount
    const recommendationsWithPrice = sortedRecommendations.map((rec: any) => {
      let finalPrice = parseFloat(String(rec.price || 0));
      const discountPercent = parseFloat(String(rec.discount_percent || 0));
      const discountStartDate = rec.discount_start_date;
      const discountEndDate = rec.discount_end_date;
      
      const isDiscountActive = discountPercent > 0 &&
        (!discountStartDate || new Date(discountStartDate) <= new Date()) &&
        (!discountEndDate || new Date(discountEndDate) >= new Date());
      
      if (isDiscountActive) {
        finalPrice = finalPrice * (1 - discountPercent / 100);
      }

      return {
        ...rec,
        final_price: finalPrice,
        active_discount_percent: isDiscountActive ? discountPercent : 0,
      };
    });

    res.json(recommendationsWithPrice);
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

