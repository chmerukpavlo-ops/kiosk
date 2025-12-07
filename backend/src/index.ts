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

