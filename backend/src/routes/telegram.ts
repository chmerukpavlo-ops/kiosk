import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { sendTelegramMessage, sendSaleNotification, sendLowStockNotification, sendDailyReport } from '../services/telegram.js';

const router = express.Router();

// Get user's Telegram chat ID (for linking)
router.get('/chat-id', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.user?.id;
    
    // Get user's Telegram settings
    const result = await query(
      'SELECT telegram_chat_id FROM users WHERE id = $1',
      [userId]
    );

    const chatId = result.rows[0]?.telegram_chat_id;

    res.json({
      chat_id: chatId || null,
      has_telegram: !!chatId,
    });
  } catch (error) {
    console.error('Get Telegram chat ID error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Link Telegram chat ID to user
router.post('/link', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { chat_id } = req.body;
    const userId = req.user?.id;

    if (!chat_id) {
      return res.status(400).json({ error: 'Chat ID обов\'язковий' });
    }

    // Update user's Telegram chat ID
    await query(
      'UPDATE users SET telegram_chat_id = $1 WHERE id = $2',
      [chat_id, userId]
    );

    // Send test message
    const sent = await sendTelegramMessage(
      chat_id,
      '✅ Ваш Telegram успішно підключено до системи кіоску! Ви будете отримувати сповіщення про продажі та важливі події.'
    );

    if (!sent) {
      return res.status(400).json({ error: 'Не вдалося надіслати тестове повідомлення. Перевірте правильність Chat ID.' });
    }

    res.json({ message: 'Telegram успішно підключено' });
  } catch (error) {
    console.error('Link Telegram error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Unlink Telegram
router.post('/unlink', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.user?.id;

    await query(
      'UPDATE users SET telegram_chat_id = NULL WHERE id = $1',
      [userId]
    );

    res.json({ message: 'Telegram відключено' });
  } catch (error) {
    console.error('Unlink Telegram error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get Telegram settings (admin)
router.get('/settings', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await query(
      `SELECT 
        u.id,
        u.full_name,
        u.telegram_chat_id,
        COUNT(s.id) as sales_count
      FROM users u
      LEFT JOIN sales s ON u.id = s.seller_id AND DATE(s.created_at) = CURRENT_DATE
      WHERE u.role IN ('admin', 'seller')
      GROUP BY u.id, u.full_name, u.telegram_chat_id
      ORDER BY u.full_name`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get Telegram settings error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Test notification (admin)
router.post('/test', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { chat_id } = req.body;

    if (!chat_id) {
      return res.status(400).json({ error: 'Chat ID обов\'язковий' });
    }

    const sent = await sendTelegramMessage(
      chat_id,
      '🧪 <b>Тестове повідомлення</b>\n\nЦе тестове сповіщення від системи кіоску. Якщо ви бачите це повідомлення, налаштування працюють правильно!'
    );

    if (!sent) {
      return res.status(400).json({ error: 'Не вдалося надіслати повідомлення' });
    }

    res.json({ message: 'Тестове повідомлення надіслано' });
  } catch (error) {
    console.error('Test Telegram notification error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

