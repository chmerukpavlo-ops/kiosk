import express from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { autoCloseShifts, generateDailyReports, cleanupOldLogs } from '../services/automation.js';

const router = express.Router();

// Автоматичне закриття змін (admin only)
router.post('/close-shifts', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await autoCloseShifts();
    res.json({
      message: `Закрито ${result.closed} змін`,
      closed: result.closed,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Close shifts error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Генерація щоденних звітів (admin only)
router.post('/generate-reports', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await generateDailyReports();
    res.json({
      message: `Створено ${result.created} звітів`,
      created: result.created,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Generate reports error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Очищення старих логів (admin only)
router.post('/cleanup-logs', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await cleanupOldLogs();
    res.json({
      message: `Видалено ${result.deleted} старих логів`,
      deleted: result.deleted,
    });
  } catch (error) {
    console.error('Cleanup logs error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

