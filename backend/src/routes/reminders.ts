import express from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { getActiveReminders, markReminderRead } from '../services/reminders.js';

const router = express.Router();

// Отримати всі активні нагадування (admin only)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const reminders = await getActiveReminders();
    res.json({
      reminders,
      total: reminders.length,
      high_priority: reminders.filter((r) => r.severity === 'high').length,
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Відмітити нагадування як прочитане (admin only)
router.post('/:id/read', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    const { type } = req.body;
    
    if (!type) {
      return res.status(400).json({ error: 'Тип нагадування обов\'язковий' });
    }

    await markReminderRead(Number(id), type);
    res.json({ message: 'Нагадування відмічено як прочитане' });
  } catch (error) {
    console.error('Mark reminder read error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

