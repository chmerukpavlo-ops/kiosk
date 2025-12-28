import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { handleStockAfterProductChange } from '../services/stock.js';
import { broadcastSaleCreated, broadcastStatsUpdate } from '../services/websocket.js';
import { sendSaleNotification } from '../services/telegram.js';
import axios from 'axios';

const router = express.Router();

// Get all sales
router.get('/', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { date, seller_id, kiosk_id, startDate, endDate } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const userId = req.user?.id;

    let sql = `
      SELECT s.*, 
             p.name as product_name,
             u.full_name as seller_name,
             k.name as kiosk_name
      FROM sales s
      LEFT JOIN products p ON s.product_id = p.id
      LEFT JOIN users u ON s.seller_id = u.id
      LEFT JOIN kiosks k ON s.kiosk_id = k.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    // Sellers only see their sales
    if (!isAdmin && userId) {
      sql += ` AND s.seller_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (seller_id) {
      sql += ` AND s.seller_id = $${paramCount}`;
      params.push(seller_id);
      paramCount++;
    }

    if (kiosk_id) {
      sql += ` AND s.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (date) {
      sql += ` AND DATE(s.created_at) = $${paramCount}`;
      params.push(date);
      paramCount++;
    }

    if (startDate && endDate) {
      sql += ` AND DATE(s.created_at) BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    }

    if (req.query.search) {
      sql += ` AND (p.name ILIKE $${paramCount} OR u.full_name ILIKE $${paramCount})`;
      params.push(`%${req.query.search}%`);
      paramCount++;
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 1000;
    sql += ` ORDER BY s.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create sale (sell product)
router.post('/', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { product_id, quantity = 1, customer_id } = req.body;
    const seller_id = req.user!.id;
    const isAdmin = req.user?.role === 'admin';

    if (!product_id) {
      return res.status(400).json({ error: 'ID товару обов\'язковий' });
    }

    // Validate quantity
    const quantityNum = Number(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0 || !Number.isInteger(quantityNum)) {
      return res.status(400).json({ error: 'Кількість повинна бути додатнім цілим числом' });
    }

    // Get product
    const productResult = await query(
      'SELECT * FROM products WHERE id = $1',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Товар не знайдено' });
    }

    const product = productResult.rows[0];

    // Check if seller has access to this product's kiosk
    if (!isAdmin && req.user?.kiosk_id !== product.kiosk_id) {
      return res.status(403).json({ error: 'Немає доступу до цього товару' });
    }

    // Check quantity
    if (product.quantity < quantityNum) {
      return res.status(400).json({ error: 'Недостатня кількість товару' });
    }

    // Validate customer_id if provided
    if (customer_id) {
      const customerIdNum = Number(customer_id);
      if (isNaN(customerIdNum)) {
        return res.status(400).json({ error: 'Невірний ID клієнта' });
      }
      const customerCheck = await query('SELECT id FROM customers WHERE id = $1', [customerIdNum]);
      if (customerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Клієнт не знайдено' });
      }
    }

    // Get seller's kiosk
    const userResult = await query('SELECT kiosk_id FROM users WHERE id = $1', [seller_id]);
    const kiosk_id = userResult.rows[0]?.kiosk_id || product.kiosk_id;

    // Calculate total price with discount
    let finalPrice = parseFloat(String(product.price || 0));
    const discountPercent = parseFloat(String(product.discount_percent || 0));
    const discountStartDate = product.discount_start_date;
    const discountEndDate = product.discount_end_date;
    
    // Check if discount is active
    const isDiscountActive = discountPercent > 0 &&
      (!discountStartDate || new Date(discountStartDate) <= new Date()) &&
      (!discountEndDate || new Date(discountEndDate) >= new Date());
    
    if (isDiscountActive) {
      finalPrice = finalPrice * (1 - discountPercent / 100);
    }
    
    const totalPrice = finalPrice * quantityNum;
    
    if (isNaN(totalPrice) || totalPrice < 0) {
      return res.status(400).json({ error: 'Невірна ціна товару' });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Create sale
      const saleResult = await query(
        `INSERT INTO sales (product_id, seller_id, kiosk_id, quantity, price, customer_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [product_id, seller_id, kiosk_id, quantityNum, totalPrice, customer_id || null]
      );

      // Update product quantity
      const newQuantity = product.quantity - quantityNum;
      await query(
        `UPDATE products 
         SET quantity = $1, 
             status = CASE WHEN $1 = 0 THEN 'out_of_stock' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newQuantity, product_id]
      );

      await query('COMMIT');

      // Broadcast WebSocket events
      const saleData = {
        id: saleResult.rows[0].id,
        product_id: product.id,
        product_name: product.name,
        seller_id: seller_id,
        kiosk_id: kiosk_id,
        quantity: quantityNum,
        price: totalPrice,
        created_at: saleResult.rows[0].created_at,
      };
      
      broadcastSaleCreated(saleData);
      
      // Broadcast stats update
      try {
        const statsResult = await query(
          `SELECT 
            COALESCE(SUM(price), 0) as revenue_today,
            COUNT(*) as sales_today
          FROM sales 
          WHERE DATE(created_at) = CURRENT_DATE`
        );
        
        if (statsResult.rows.length > 0) {
          broadcastStatsUpdate({
            revenue_today: parseFloat(statsResult.rows[0].revenue_today || '0'),
            sales_today: parseInt(statsResult.rows[0].sales_today || '0'),
          });
        }
      } catch (e) {
        console.error('Failed to broadcast stats update:', e);
      }

      // Update customer stats if customer_id provided
      if (customer_id) {
        try {
          const { updateCustomerStats } = await import('./customers.js');
          await updateCustomerStats(Number(customer_id), totalPrice);
        } catch (e) {
          console.error('Update customer stats failed:', e);
        }
      }

      // Low-stock alerts + auto reorder draft update
      try {
        await handleStockAfterProductChange({ product_id: Number(product_id) });
      } catch (e) {
        console.error('Stock check after sale failed:', e);
      }

      // Check achievements for seller
      try {
        const { checkAchievements } = await import('./gamification.js');
        await checkAchievements(seller_id);
      } catch (e) {
        console.error('Check achievements failed:', e);
      }

      // Get sale with details
      const fullSaleResult = await query(
        `SELECT s.*, 
                p.name as product_name,
                u.full_name as seller_name,
                k.name as kiosk_name
         FROM sales s
         LEFT JOIN products p ON s.product_id = p.id
         LEFT JOIN users u ON s.seller_id = u.id
         LEFT JOIN kiosks k ON s.kiosk_id = k.id
         WHERE s.id = $1`,
        [saleResult.rows[0].id]
      );

      res.status(201).json(fullSaleResult.rows[0]);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete sale (cancel sale) - only for recent sales (within 30 minutes)
router.delete('/:id', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const saleId = parseInt(req.params.id);
    const userId = req.user!.id;
    const isAdmin = req.user?.role === 'admin';

    if (!saleId) {
      return res.status(400).json({ error: 'ID продажу обов\'язковий' });
    }

    // Get sale
    const saleResult = await query(
      `SELECT s.*, p.name as product_name
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       WHERE s.id = $1`,
      [saleId]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Продаж не знайдено' });
    }

    const sale = saleResult.rows[0];

    // Check permissions - seller can only cancel their own sales
    if (!isAdmin && sale.seller_id !== userId) {
      return res.status(403).json({ error: 'Немає доступу до цього продажу' });
    }

    // Check if sale is recent (within 30 minutes)
    const saleTime = new Date(sale.created_at);
    const now = new Date();
    const minutesDiff = (now.getTime() - saleTime.getTime()) / (1000 * 60);

    if (minutesDiff > 30) {
      return res.status(400).json({ error: 'Можна відмінити тільки продажі за останні 30 хвилин' });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Restore product quantity
      await query(
        `UPDATE products 
         SET quantity = quantity + $1,
             status = CASE WHEN quantity + $1 > 0 THEN 'available' ELSE status END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [sale.quantity, sale.product_id]
      );

      // Delete sale
      await query('DELETE FROM sales WHERE id = $1', [saleId]);

      await query('COMMIT');

      // Low-stock alerts + auto reorder draft update (after cancel)
      try {
        await handleStockAfterProductChange({ product_id: Number(sale.product_id) });
      } catch (e) {
        console.error('Stock check after cancel failed:', e);
      }

      res.json({ message: 'Продаж успішно відмінено', sale });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get sales statistics
router.get('/stats', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { period = 'day', kiosk_id, seller_id } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const userId = req.user?.id;

    let dateFilter = '';
    if (period === 'day') {
      dateFilter = "DATE(created_at) = CURRENT_DATE";
    } else if (period === 'week') {
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    let sql = `SELECT 
      COUNT(*) as total_sales,
      SUM(price) as total_revenue,
      SUM(quantity) as total_items
    FROM sales WHERE ${dateFilter}`;

    const params: any[] = [];
    let paramCount = 1;

    if (!isAdmin && userId) {
      sql += ` AND seller_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    if (kiosk_id) {
      sql += ` AND kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (seller_id) {
      sql += ` AND seller_id = $${paramCount}`;
      params.push(seller_id);
      paramCount++;
    }

    const result = await query(sql, params);
    res.json(result.rows[0] || { total_sales: 0, total_revenue: 0, total_items: 0 });
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Send receipt via Telegram
router.post('/:id/send-telegram', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const saleId = parseInt(req.params.id);
    
    if (isNaN(saleId)) {
      return res.status(400).json({ error: 'Невірний ID продажу' });
    }
    
    const { telegram_chat_id, telegram_username } = req.body;

    if (!telegram_chat_id && !telegram_username) {
      return res.status(400).json({ error: 'Telegram chat_id або username обов\'язковий' });
    }

    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!telegramBotToken) {
      console.error('TELEGRAM_BOT_TOKEN не встановлено в змінних оточення');
      return res.status(500).json({ 
        error: 'Telegram бот не налаштований. Додайте TELEGRAM_BOT_TOKEN в backend/.env' 
      });
    }

    // Get sale details
    const saleResult = await query(
      `SELECT s.*, 
              p.name as product_name,
              u.full_name as seller_name,
              k.name as kiosk_name
       FROM sales s
       LEFT JOIN products p ON s.product_id = p.id
       LEFT JOIN users u ON s.seller_id = u.id
       LEFT JOIN kiosks k ON s.kiosk_id = k.id
       WHERE s.id = $1`,
      [saleId]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Продаж не знайдено' });
    }

    const sale = saleResult.rows[0];

    // Format receipt as text
    const receiptText = formatReceiptText(sale);

    // Determine chat_id
    let chatId: string | number = telegram_chat_id;
    
    // If username provided, try to resolve it (requires user to start bot first)
    if (telegram_username && !chatId) {
      // For username, we need user to start bot first and send a message
      // Remove @ if present and use username directly
      const cleanUsername = telegram_username.replace('@', '').trim();
      chatId = cleanUsername;
    }

    // Validate chat_id format
    if (!chatId) {
      return res.status(400).json({ error: 'Не вдалося визначити chat_id або username' });
    }

    // Send message via Telegram Bot API
    try {
      const telegramApiUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
      
      // Debug log (only in development)
      if (process.env.NODE_ENV === 'development') {
        console.log('Sending Telegram message:', {
          chatId: chatId,
          textLength: receiptText.length,
          hasToken: !!telegramBotToken,
        });
      }
      
      const response = await axios.post(telegramApiUrl, {
        chat_id: chatId,
        text: receiptText,
        parse_mode: 'HTML',
      }, {
        timeout: 10000, // 10 seconds timeout
      });

      res.json({ 
        success: true, 
        message: 'Чек надіслано в Telegram',
        telegram_response: response.data 
      });
    } catch (telegramError: any) {
      console.error('Telegram API error:', {
        status: telegramError.response?.status,
        data: telegramError.response?.data,
        message: telegramError.message,
        chatId: chatId,
      });
      
      let errorMessage = 'Помилка надсилання в Telegram';
      
      if (telegramError.response?.data) {
        const tgError = telegramError.response.data;
        if (tgError.description) {
          errorMessage = tgError.description;
          
          // Переклади помилок Telegram на українську
          if (tgError.description.includes('chat not found')) {
            errorMessage = 'Чат не знайдено. Переконайтеся, що користувач написав боту спочатку.';
          } else if (tgError.description.includes('user not found')) {
            errorMessage = 'Користувач не знайдено. Перевірте правильність username або chat_id.';
          } else if (tgError.description.includes('bot was blocked')) {
            errorMessage = 'Бот заблоковано користувачем.';
          } else if (tgError.description.includes('invalid chat_id')) {
            errorMessage = 'Невірний chat_id або username.';
          }
        }
      } else if (telegramError.message) {
        errorMessage = telegramError.message;
      }
      
      // Логуємо детальну інформацію для діагностики
      console.error('Full Telegram error details:', JSON.stringify({
        error: errorMessage,
        telegramError: telegramError.response?.data,
        chatId: chatId,
        chatIdType: typeof chatId,
      }, null, 2));
      
      return res.status(400).json({ 
        error: errorMessage,
        details: telegramError.response?.data || null,
        chat_id_used: chatId
      });
    }
  } catch (error: any) {
    console.error('Send telegram receipt error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

function formatReceiptText(sale: any): string {
  const date = new Date(sale.created_at);
  const formattedDate = date.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
🧾 <b>ЧЕК №${sale.id}</b>

🏪 <b>${sale.kiosk_name || 'КІОСК'}</b>
📅 ${formattedDate}

━━━━━━━━━━━━━━━━━━
📦 <b>${sale.product_name || 'Товар'}</b>
   Кількість: ${sale.quantity} шт.
   Ціна: ${parseFloat(sale.price).toFixed(2)} ₴
━━━━━━━━━━━━━━━━━━

💰 <b>ВСЬОГО: ${parseFloat(sale.price).toFixed(2)} ₴</b>

👤 Продавець: ${sale.seller_name || '—'}

━━━━━━━━━━━━━━━━━━
✅ Дякуємо за покупку!
  `.trim();
}

export default router;

