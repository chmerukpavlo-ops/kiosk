import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: 'admin' | 'seller' | 'manager' | 'accountant';
    kiosk_id?: number;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Токен не надано' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Невірний токен' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Доступ заборонено. Потрібні права адміністратора' });
  }
  next();
};

export const requireSeller = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'seller') {
    return res.status(403).json({ error: 'Доступ заборонено. Потрібні права продавця' });
  }
  next();
};

