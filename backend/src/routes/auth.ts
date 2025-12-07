import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/init.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Login
router.post('/login', async (req: express.Request, res: express.Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Логін та пароль обов\'язкові' });
    }

    const result = await query(
      'SELECT id, username, password, full_name, role, kiosk_id FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Невірний логін або пароль' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Невірний логін або пароль' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        kiosk_id: user.kiosk_id,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        kiosk_id: user.kiosk_id,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const result = await query(
      'SELECT id, username, full_name, role, kiosk_id FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Користувач не знайдений' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

