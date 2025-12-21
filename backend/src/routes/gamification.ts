import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { query } from '../db/init';

const router = Router();

// Get user achievements and stats
router.get('/achievements', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизовано' });
    }

    // Get user's earned achievements
    const userAchievements = await query(
      `SELECT a.*, ua.earned_at
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = $1
       ORDER BY ua.earned_at DESC`,
      [userId]
    );

    // Get all achievements with earned status
    const allAchievements = await query(
      `SELECT a.*, 
              CASE WHEN ua.user_id IS NOT NULL THEN true ELSE false END as earned,
              ua.earned_at
       FROM achievements a
       LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
       ORDER BY a.category, a.points DESC`,
      [userId]
    );

    // Get user stats for today
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await query(
      `SELECT 
        COUNT(*) as sales_count,
        COALESCE(SUM(price * quantity), 0) as revenue
       FROM sales
       WHERE seller_id = $1 AND DATE(created_at) = $2`,
      [userId, today]
    );

    // Get total points
    const totalPoints = await query(
      `SELECT COALESCE(SUM(a.points), 0) as total_points
       FROM user_achievements ua
       JOIN achievements a ON ua.achievement_id = a.id
       WHERE ua.user_id = $1`,
      [userId]
    );

    // Get daily goal
    const dailyGoal = await query(
      `SELECT * FROM daily_goals
       WHERE user_id = $1 AND date = $2`,
      [userId, today]
    );

    res.json({
      achievements: allAchievements.rows,
      earned: userAchievements.rows,
      stats: {
        today: {
          sales: parseInt(todayStats.rows[0]?.sales_count || 0),
          revenue: parseFloat(todayStats.rows[0]?.revenue || 0),
        },
        total_points: parseInt(totalPoints.rows[0]?.total_points || 0),
      },
      daily_goal: dailyGoal.rows[0] || null,
    });
  } catch (error: any) {
    console.error('Get achievements error:', error);
    res.status(500).json({ error: 'Помилка завантаження досягнень' });
  }
});

// Get leaderboard
router.get('/leaderboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const period = req.query.period || 'today'; // today, week, month
    let dateFilter = '';

    if (period === 'today') {
      dateFilter = "AND DATE(s.created_at) = CURRENT_DATE";
    } else if (period === 'week') {
      dateFilter = "AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    const leaderboard = await query(
      `SELECT 
        u.id,
        u.full_name,
        COUNT(DISTINCT s.id) as sales_count,
        COALESCE(SUM(s.price * s.quantity), 0) as revenue,
        COALESCE(SUM(a.points), 0) as total_points
       FROM users u
       LEFT JOIN sales s ON u.id = s.seller_id ${dateFilter}
       LEFT JOIN user_achievements ua ON u.id = ua.user_id
       LEFT JOIN achievements a ON ua.achievement_id = a.id
       WHERE u.role = 'seller'
       GROUP BY u.id, u.full_name
       ORDER BY revenue DESC, sales_count DESC
       LIMIT 10`,
      []
    );

    res.json(leaderboard.rows);
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Помилка завантаження рейтингу' });
  }
});

// Set daily goal
router.post('/daily-goal', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Не авторизовано' });
    }

    const { sales_target, revenue_target } = req.body;
    const today = new Date().toISOString().split('T')[0];

    await query(
      `INSERT INTO daily_goals (user_id, date, sales_target, revenue_target)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         sales_target = EXCLUDED.sales_target,
         revenue_target = EXCLUDED.revenue_target,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, today, sales_target || 0, revenue_target || 0]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Set daily goal error:', error);
    res.status(500).json({ error: 'Помилка встановлення цілі' });
  }
});

// Check and award achievements (called after sale)
export async function checkAchievements(userId: number) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get today's stats
    const stats = await query(
      `SELECT 
        COUNT(*) as sales_count,
        COALESCE(SUM(price * quantity), 0) as revenue
       FROM sales
       WHERE seller_id = $1 AND DATE(created_at) = $2`,
      [userId, today]
    );

    const salesCount = parseInt(stats.rows[0]?.sales_count || 0);
    const revenue = parseFloat(stats.rows[0]?.revenue || 0);

    // Check achievements
    const achievementsToCheck = [
      { code: 'first_sale', condition: salesCount >= 1 },
      { code: 'sales_10', condition: salesCount >= 10 },
      { code: 'sales_50', condition: salesCount >= 50 },
      { code: 'sales_100', condition: salesCount >= 100 },
      { code: 'revenue_1000', condition: revenue >= 1000 },
      { code: 'revenue_5000', condition: revenue >= 5000 },
      { code: 'revenue_10000', condition: revenue >= 10000 },
    ];

    for (const { code, condition } of achievementsToCheck) {
      if (condition) {
        // Check if already earned
        const existing = await query(
          `SELECT ua.id
           FROM user_achievements ua
           JOIN achievements a ON ua.achievement_id = a.id
           WHERE ua.user_id = $1 AND a.code = $2`,
          [userId, code]
        );

        if (existing.rows.length === 0) {
          // Award achievement
          await query(
            `INSERT INTO user_achievements (user_id, achievement_id)
             SELECT $1, a.id
             FROM achievements a
             WHERE a.code = $2
             ON CONFLICT (user_id, achievement_id) DO NOTHING`,
            [userId, code]
          );
        }
      }
    }
  } catch (error) {
    console.error('Check achievements error:', error);
  }
}

export default router;

