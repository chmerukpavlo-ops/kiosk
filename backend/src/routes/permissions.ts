import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getRolePermissions, hasPermission } from '../middleware/permissions.js';
import type { Entity, Action } from '../middleware/permissions.js';

const router = express.Router();

// Отримати права поточної ролі користувача
router.get('/my-permissions', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const role = req.user?.role || 'seller';
    const permissions = getRolePermissions(role);
    
    res.json({
      role,
      permissions,
    });
  } catch (error) {
    console.error('Get permissions error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Перевірити чи має користувач конкретне право
router.post('/check', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    const { entity, action } = req.body as { entity: Entity; action: Action };
    const role = req.user?.role || 'seller';

    if (!entity || !action) {
      return res.status(400).json({ error: 'Entity та action обов\'язкові' });
    }

    const hasAccess = hasPermission(role, entity, action);
    
    res.json({
      hasAccess,
      role,
      entity,
      action,
    });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

// Отримати список всіх доступних ролей та їх прав (тільки для адміністраторів)
router.get('/roles', authenticate, async (req: AuthRequest, res: express.Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Доступ заборонено' });
    }

    const roles = ['admin', 'seller', 'manager', 'accountant'];
    const rolesWithPermissions = roles.map(role => ({
      role,
      permissions: getRolePermissions(role),
    }));

    res.json({
      roles: rolesWithPermissions,
    });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Помилка сервера' });
  }
});

export default router;

