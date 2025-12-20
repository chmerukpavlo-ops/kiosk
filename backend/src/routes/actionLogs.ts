import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Отримати логи дій (admin only)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { 
      page = '1', 
      limit = '50', 
      action_type, 
      entity_type, 
      user_id,
      start_date,
      end_date 
    } = req.query;

    const pageNum = parseInt(String(page)) || 1;
    const limitNum = parseInt(String(limit)) || 50;
    const offset = (pageNum - 1) * limitNum;

    let sql = `
      SELECT 
        al.*,
        u.username,
        u.full_name,
        u.role
      FROM action_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (action_type) {
      sql += ` AND al.action_type = $${paramCount}`;
      params.push(action_type);
      paramCount++;
    }

    if (entity_type) {
      sql += ` AND al.entity_type = $${paramCount}`;
      params.push(entity_type);
      paramCount++;
    }

    if (user_id) {
      sql += ` AND al.user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    if (start_date) {
      sql += ` AND al.created_at >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      sql += ` AND al.created_at <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    sql += ` ORDER BY al.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limitNum, offset);

    const result = await query(sql, params);

    // Отримати загальну кількість
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*$/, '');
    const countResult = await query(countSql, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.total || '0');

    res.json({
      logs: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get action logs error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Отримати статистику логів
router.get('/stats', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { period = '7' } = req.query;
    const periodDays = parseInt(String(period)) || 7;

    // Статистика по типах дій
    const actionTypesStats = await query(`
      SELECT 
        action_type,
        COUNT(*) as count
      FROM action_logs
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      GROUP BY action_type
      ORDER BY count DESC
    `, [periodDays]);

    // Статистика по типах сутностей
    const entityTypesStats = await query(`
      SELECT 
        entity_type,
        COUNT(*) as count
      FROM action_logs
      WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      GROUP BY entity_type
      ORDER BY count DESC
    `, [periodDays]);

    // Статистика по користувачах
    const usersStats = await query(`
      SELECT 
        u.id,
        u.username,
        u.full_name,
        COUNT(*) as action_count
      FROM action_logs al
      JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= CURRENT_DATE - INTERVAL '1 day' * $1
      GROUP BY u.id, u.username, u.full_name
      ORDER BY action_count DESC
      LIMIT 10
    `, [periodDays]);

    res.json({
      action_types: actionTypesStats.rows,
      entity_types: entityTypesStats.rows,
      top_users: usersStats.rows,
      period_days: periodDays,
    });
  } catch (error) {
    console.error('Get action logs stats error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

