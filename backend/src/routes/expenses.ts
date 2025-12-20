import express from 'express';
import { query } from '../db/init.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all expenses (with filters)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { startDate, endDate, category, kiosk_id, status } = req.query;

    let sql = `
      SELECT e.*, 
             k.name as kiosk_name,
             u.full_name as created_by_name
      FROM expenses e
      LEFT JOIN kiosks k ON e.kiosk_id = k.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (startDate) {
      sql += ` AND e.date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      sql += ` AND e.date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    if (category) {
      sql += ` AND e.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (kiosk_id) {
      sql += ` AND e.kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (status) {
      const s = String(status);
      if (!['paid', 'planned', 'cancelled', 'all'].includes(s)) {
        return res.status(400).json({ error: 'Невірний статус' });
      }
      if (s !== 'all') {
        sql += ` AND COALESCE(e.status, 'paid') = $${paramCount}`;
        params.push(s);
        paramCount++;
      }
    }

    sql += ' ORDER BY e.date DESC, e.created_at DESC LIMIT 1000';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get expenses statistics
router.get('/stats', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { period = 'day', kiosk_id, category, compare = 'false' } = req.query;

    let dateFilter = '';
    let previousDateFilter = '';
    
    if (period === 'day') {
      dateFilter = "date = CURRENT_DATE";
      previousDateFilter = "date = CURRENT_DATE - INTERVAL '1 day'";
    } else if (period === 'week') {
      dateFilter = "date >= CURRENT_DATE - INTERVAL '7 days' AND date < CURRENT_DATE + INTERVAL '1 day'";
      previousDateFilter = "date >= CURRENT_DATE - INTERVAL '14 days' AND date < CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "date >= DATE_TRUNC('month', CURRENT_DATE) AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'";
      previousDateFilter = "date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND date < DATE_TRUNC('month', CURRENT_DATE)";
    }

    let sql = `SELECT 
      COUNT(*) as total_expenses,
      SUM(amount) as total_amount,
      category,
      SUM(amount) as category_amount
    FROM expenses WHERE ${dateFilter} AND COALESCE(status, 'paid') = 'paid'`;

    const params: any[] = [];
    let paramCount = 1;

    if (kiosk_id) {
      sql += ` AND kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (category) {
      sql += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    sql += ' GROUP BY category';

    const result = await query(sql, params);
    
    // Загальна сума
    const totalResult = await query(
      `SELECT COALESCE(SUM(amount), 0) as total 
       FROM expenses WHERE ${dateFilter} AND COALESCE(status, 'paid') = 'paid'${kiosk_id ? ` AND kiosk_id = $1` : ''}${category ? ` AND category = $${kiosk_id ? 2 : 1}` : ''}`,
      kiosk_id || category ? [kiosk_id, category].filter(Boolean) : []
    );

    const response: any = {
      total: parseFloat(totalResult.rows[0]?.total || '0'),
      by_category: result.rows,
    };

    // Порівняння з попереднім періодом
    if (compare === 'true') {
      const previousTotalResult = await query(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM expenses WHERE ${previousDateFilter} AND COALESCE(status, 'paid') = 'paid'${kiosk_id ? ` AND kiosk_id = $1` : ''}${category ? ` AND category = $${kiosk_id ? 2 : 1}` : ''}`,
        kiosk_id || category ? [kiosk_id, category].filter(Boolean) : []
      );

      const previousTotal = parseFloat(previousTotalResult.rows[0]?.total || '0');
      const currentTotal = response.total;
      const difference = currentTotal - previousTotal;
      const percentChange = previousTotal > 0 ? ((difference / previousTotal) * 100) : 0;

      response.comparison = {
        previous_total: previousTotal,
        difference: difference,
        percent_change: percentChange,
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Get expenses stats error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get expenses chart data (by date)
router.get('/chart', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { startDate, endDate, kiosk_id, category } = req.query;

    let dateFilter = '';
    if (startDate && endDate) {
      dateFilter = `date >= '${startDate}' AND date <= '${endDate}'`;
    } else {
      // Default to last 30 days
      dateFilter = "date >= CURRENT_DATE - INTERVAL '30 days'";
    }

    let sql = `SELECT 
      date,
      SUM(amount) as total_amount,
      category,
      SUM(amount) as category_amount
    FROM expenses WHERE ${dateFilter} AND COALESCE(status, 'paid') = 'paid'`;

    const params: any[] = [];
    let paramCount = 1;

    if (kiosk_id) {
      sql += ` AND kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    if (category) {
      sql += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    sql += ' GROUP BY date, category ORDER BY date';

    const result = await query(sql, params);

    // Transform data for chart - group by date
    const chartData: Record<string, any> = {};
    result.rows.forEach((row: any) => {
      const date = row.date;
      if (!chartData[date]) {
        chartData[date] = { date, rent: 0, purchase: 0, other: 0, total: 0 };
      }
      chartData[date][row.category] = parseFloat(row.category_amount || '0');
      chartData[date].total += parseFloat(row.category_amount || '0');
    });

    res.json(Object.values(chartData));
  } catch (error) {
    console.error('Get expenses chart error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get revenue vs expenses chart data
router.get('/revenue-vs-expenses', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { startDate, endDate, kiosk_id } = req.query;

    let expensesDateFilter = '';
    let salesDateFilter = '';
    const params: any[] = [];
    let paramCount = 1;

    if (startDate && endDate) {
      expensesDateFilter = `date >= $${paramCount} AND date <= $${paramCount + 1}`;
      salesDateFilter = `DATE(created_at) >= $${paramCount} AND DATE(created_at) <= $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    } else {
      expensesDateFilter = "date >= CURRENT_DATE - INTERVAL '30 days'";
      salesDateFilter = "DATE(created_at) >= CURRENT_DATE - INTERVAL '30 days'";
    }

    // Get expenses by date
    let expensesSql = `SELECT 
      date,
      COALESCE(SUM(amount), 0) as expenses
    FROM expenses WHERE ${expensesDateFilter} AND COALESCE(status, 'paid') = 'paid'`;

    if (kiosk_id) {
      expensesSql += ` AND kiosk_id = $${paramCount}`;
      params.push(kiosk_id);
      paramCount++;
    }

    expensesSql += ' GROUP BY date ORDER BY date';

    const expensesResult = await query(expensesSql, params);

    // Get revenue by date
    let revenueParams: any[] = [];
    let revenueParamCount = 1;
    let revenueSql = `SELECT 
      DATE(created_at) as date,
      COALESCE(SUM(price), 0) as revenue
    FROM sales WHERE ${salesDateFilter}`;

    if (kiosk_id) {
      revenueSql += ` AND kiosk_id = $${revenueParamCount}`;
      revenueParams.push(kiosk_id);
      revenueParamCount++;
    }

    if (startDate && endDate) {
      revenueParams = [startDate, endDate, ...revenueParams];
    }

    revenueSql += ' GROUP BY DATE(created_at) ORDER BY DATE(created_at)';

    const revenueResult = await query(revenueSql, revenueParams);

    // Merge data by date
    const expensesMap = new Map(expensesResult.rows.map((r: any) => [r.date, parseFloat(r.expenses || '0')]));
    const revenueMap = new Map(revenueResult.rows.map((r: any) => [r.date, parseFloat(r.revenue || '0')]));

    // Get all unique dates
    const allDates = new Set([
      ...expensesResult.rows.map((r: any) => r.date),
      ...revenueResult.rows.map((r: any) => r.date),
    ]);

    const chartData = Array.from(allDates)
      .sort()
      .map((date) => {
        const revenue = revenueMap.get(date) || 0;
        const expenses = expensesMap.get(date) || 0;
        return {
          date,
          revenue,
          expenses,
          profit: revenue - expenses,
        };
      });

    res.json(chartData);
  } catch (error) {
    console.error('Get revenue vs expenses chart error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Create expense
router.post('/', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id, category, description, amount, date, status, recurrence } = req.body;
    const created_by = req.user!.id;

    if (!category || !amount || !date) {
      return res.status(400).json({ error: 'Категорія, сума та дата обов\'язкові' });
    }

    if (!['rent', 'purchase', 'utilities', 'advertising', 'salary', 'other'].includes(category)) {
      return res.status(400).json({ error: 'Невірна категорія' });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Сума повинна бути більше 0' });
    }

    const normalizedStatus = status ? String(status) : 'paid';
    if (!['paid', 'planned', 'cancelled'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Невірний статус' });
    }

    const normalizedRecurrence = recurrence ? String(recurrence) : 'none';
    if (!['none', 'monthly'].includes(normalizedRecurrence)) {
      return res.status(400).json({ error: 'Невірна періодичність' });
    }

    const planned_for = normalizedStatus === 'planned' ? date : null;
    const paid_at = normalizedStatus === 'paid' ? date : null;

    const result = await query(
      `INSERT INTO expenses (kiosk_id, category, description, amount, date, created_by, status, planned_for, paid_at, recurrence)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        kiosk_id || null,
        category,
        description || null,
        parseFloat(amount),
        date,
        created_by,
        normalizedStatus,
        planned_for,
        paid_at,
        normalizedRecurrence,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Update expense
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { kiosk_id, category, description, amount, date, status, recurrence } = req.body;

    if (category && !['rent', 'purchase', 'utilities', 'advertising', 'salary', 'other'].includes(category)) {
      return res.status(400).json({ error: 'Невірна категорія' });
    }

    if (amount && parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Сума повинна бути більше 0' });
    }

    if (status && !['paid', 'planned', 'cancelled'].includes(String(status))) {
      return res.status(400).json({ error: 'Невірний статус' });
    }

    if (recurrence && !['none', 'monthly'].includes(String(recurrence))) {
      return res.status(400).json({ error: 'Невірна періодичність' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (kiosk_id !== undefined) {
      updates.push(`kiosk_id = $${paramCount}`);
      params.push(kiosk_id || null);
      paramCount++;
    }

    if (category) {
      updates.push(`category = $${paramCount}`);
      params.push(category);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description || null);
      paramCount++;
    }

    if (amount) {
      updates.push(`amount = $${paramCount}`);
      params.push(parseFloat(amount));
      paramCount++;
    }

    if (date) {
      updates.push(`date = $${paramCount}`);
      params.push(date);
      paramCount++;
    }

    if (status) {
      updates.push(`status = $${paramCount}`);
      params.push(String(status));
      paramCount++;

      // Keep helper columns consistent when status changes
      if (String(status) === 'planned') {
        if (date) {
          updates.push(`planned_for = $${paramCount}`);
          params.push(date);
          paramCount++;
        }
        updates.push(`paid_at = NULL`);
      }
      if (String(status) === 'paid') {
        if (date) {
          updates.push(`paid_at = $${paramCount}`);
          params.push(date);
          paramCount++;
        }
      }
    }

    if (recurrence !== undefined) {
      updates.push(`recurrence = $${paramCount}`);
      params.push(String(recurrence || 'none'));
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Немає даних для оновлення' });
    }

    params.push(req.params.id);
    const sql = `UPDATE expenses SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Витрата не знайдена' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Mark planned expense as paid (optionally auto-create next month for recurring items)
router.post('/:id/mark-paid', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const { paid_date } = req.body || {};
    const created_by = req.user!.id;

    const currentResult = await query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Витрата не знайдена' });
    }

    const expense = currentResult.rows[0];
    const todayISO = new Date().toISOString().split('T')[0];
    const paidISO = paid_date ? String(paid_date) : todayISO;

    const updateResult = await query(
      `UPDATE expenses
       SET status = 'paid', paid_at = $1, date = $1
       WHERE id = $2
       RETURNING *`,
      [paidISO, req.params.id]
    );

    const updated = updateResult.rows[0];

    // If recurring monthly, create next planned item
    let nextCreated: any = null;
    const recurrence = String(expense.recurrence || 'none');
    if (recurrence === 'monthly') {
      const base = expense.planned_for || expense.date || paidISO;
      const baseDate = new Date(String(base));
      if (!Number.isNaN(baseDate.getTime())) {
        const nextDate = new Date(baseDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        const nextISO = nextDate.toISOString().split('T')[0];

        const insertResult = await query(
          `INSERT INTO expenses (kiosk_id, category, description, amount, date, created_by, status, planned_for, paid_at, recurrence)
           VALUES ($1, $2, $3, $4, $5, $6, 'planned', $5, NULL, 'monthly')
           RETURNING *`,
          [
            expense.kiosk_id || null,
            expense.category,
            expense.description || null,
            parseFloat(expense.amount),
            nextISO,
            created_by,
          ]
        );
        nextCreated = insertResult.rows[0];
      }
    }

    res.json({ expense: updated, next: nextCreated });
  } catch (error) {
    console.error('Mark expense paid error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Delete expense
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await query('DELETE FROM expenses WHERE id = $1 RETURNING id', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Витрата не знайдена' });
    }

    res.json({ message: 'Витрата видалена' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

