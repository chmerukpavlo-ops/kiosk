import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';

// Типи дій та сутностей
export type Action = 'create' | 'read' | 'update' | 'delete' | 'export' | 'manage';
export type Entity = 'products' | 'sales' | 'expenses' | 'employees' | 'kiosks' | 'customers' | 'inventory' | 'schedule' | 'analytics' | 'settings';

// Права доступу для різних ролей
const PERMISSIONS: Record<string, Record<Entity, Action[]>> = {
  admin: {
    products: ['create', 'read', 'update', 'delete', 'export', 'manage'],
    sales: ['create', 'read', 'update', 'delete', 'export', 'manage'],
    expenses: ['create', 'read', 'update', 'delete', 'export', 'manage'],
    employees: ['create', 'read', 'update', 'delete', 'export', 'manage'],
    kiosks: ['create', 'read', 'update', 'delete', 'export', 'manage'],
    customers: ['create', 'read', 'update', 'delete', 'export', 'manage'],
    inventory: ['create', 'read', 'update', 'delete', 'export', 'manage'],
    schedule: ['create', 'read', 'update', 'delete', 'export', 'manage'],
    analytics: ['read', 'export', 'manage'],
    settings: ['read', 'update', 'manage'],
  },
  seller: {
    products: ['read'],
    sales: ['create', 'read'],
    expenses: [],
    employees: [],
    kiosks: [],
    customers: ['read', 'create'],
    inventory: [],
    schedule: ['read'],
    analytics: [],
    settings: [],
  },
  manager: {
    products: ['read', 'update', 'export'],
    sales: ['read', 'export'],
    expenses: ['read', 'create', 'update', 'export'],
    employees: ['read'],
    kiosks: ['read'],
    customers: ['read', 'create', 'update', 'export'],
    inventory: ['read', 'create', 'update'],
    schedule: ['read', 'create', 'update'],
    analytics: ['read', 'export'],
    settings: [],
  },
  accountant: {
    products: ['read', 'export'],
    sales: ['read', 'export'],
    expenses: ['read', 'create', 'update', 'export'],
    employees: ['read'],
    kiosks: ['read'],
    customers: ['read', 'export'],
    inventory: [],
    schedule: ['read'],
    analytics: ['read', 'export'],
    settings: [],
  },
};

/**
 * Middleware для перевірки прав доступу
 */
export function requirePermission(entity: Entity, action: Action) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || 'seller';
    const userPermissions = PERMISSIONS[userRole] || PERMISSIONS['seller'];

    if (!userPermissions[entity] || !userPermissions[entity].includes(action)) {
      return res.status(403).json({
        error: 'Доступ заборонено',
        message: `У вас немає прав для виконання дії "${action}" над "${entity}"`,
      });
    }

    next();
  };
}

/**
 * Функція для перевірки прав доступу в коді
 */
export function hasPermission(role: string, entity: Entity, action: Action): boolean {
  const userPermissions = PERMISSIONS[role] || PERMISSIONS['seller'];
  return userPermissions[entity]?.includes(action) || false;
}

/**
 * Отримати всі права для ролі
 */
export function getRolePermissions(role: string): Record<Entity, Action[]> {
  return PERMISSIONS[role] || PERMISSIONS['seller'];
}

/**
 * Middleware для перевірки кількох прав одночасно (OR логіка)
 */
export function requireAnyPermission(checks: Array<{ entity: Entity; action: Action }>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || 'seller';
    const userPermissions = PERMISSIONS[userRole] || PERMISSIONS['seller'];

    const hasAnyPermission = checks.some(
      ({ entity, action }) => userPermissions[entity]?.includes(action)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({
        error: 'Доступ заборонено',
        message: 'У вас немає необхідних прав для цієї дії',
      });
    }

    next();
  };
}

