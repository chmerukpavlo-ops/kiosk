import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db/init.js';
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import kiosksRoutes from './routes/kiosks.js';
import employeesRoutes from './routes/employees.js';
import scheduleRoutes from './routes/schedule.js';
import statsRoutes from './routes/stats.js';
import expensesRoutes from './routes/expenses.js';
import financeRoutes from './routes/finance.js';
import stockRoutes from './routes/stock.js';
import inventoryRoutes from './routes/inventory.js';
import customersRoutes from './routes/customers.js';
import analyticsRoutes from './routes/analytics.js';
import actionLogsRoutes from './routes/actionLogs.js';
import automationRoutes from './routes/automation.js';
import remindersRoutes from './routes/reminders.js';
import permissionsRoutes from './routes/permissions.js';
import gamificationRoutes from './routes/gamification.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS configuration - дозволяємо всі джерела для простоти (в production обмежте!)
app.use(cors({
  origin: '*', // В production замініть на конкретний URL frontend
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/kiosks', kiosksRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/action-logs', actionLogsRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/gamification', gamificationRoutes);

// Root endpoint - API info
app.get('/', (req, res) => {
  res.json({
    message: 'Kiosk Management API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      products: '/api/products',
      sales: '/api/sales',
      kiosks: '/api/kiosks',
      employees: '/api/employees',
      schedule: '/api/schedule',
      stats: '/api/stats',
      expenses: '/api/expenses',
      finance: '/api/finance',
      stock: '/api/stock',
      inventory: '/api/inventory',
      customers: '/api/customers',
      analytics: '/api/analytics',
      actionLogs: '/api/action-logs',
      automation: '/api/automation',
      reminders: '/api/reminders',
      permissions: '/api/permissions',
      gamification: '/api/gamification',
    },
    frontend: 'http://localhost:5173',
    docs: 'See README.md for API documentation',
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server
initDatabase()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

