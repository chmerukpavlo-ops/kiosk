import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kiosk_db',
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

export async function initDatabase() {
  try {
    // Create tables
    await query(`
      CREATE TABLE IF NOT EXISTS kiosks (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'seller')),
        kiosk_id INTEGER REFERENCES kiosks(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(255),
        type VARCHAR(100),
        price DECIMAL(10, 2) NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        kiosk_id INTEGER REFERENCES kiosks(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'out_of_stock')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        seller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        kiosk_id INTEGER REFERENCES kiosks(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Міграція: видалення колонки commission якщо вона існує
    await query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sales' AND column_name = 'commission'
        ) THEN
          ALTER TABLE sales DROP COLUMN commission;
        END IF;
      END $$;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS schedule (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        kiosk_id INTEGER REFERENCES kiosks(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        shift_start TIME,
        shift_end TIME,
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'started', 'completed', 'absent')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Додати purchase_price до products якщо не існує
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'purchase_price'
        ) THEN
          ALTER TABLE products ADD COLUMN purchase_price DECIMAL(10, 2);
        END IF;
      END $$;
    `);

    // Створити таблицю витрат
    await query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        kiosk_id INTEGER REFERENCES kiosks(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL CHECK (category IN ('rent', 'purchase', 'other')),
        description TEXT,
        amount DECIMAL(10, 2) NOT NULL,
        date DATE NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Індекси для expenses
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_kiosk ON expenses(kiosk_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);`);

    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_products_kiosk ON products(kiosk_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_kiosk ON sales(kiosk_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_schedule_employee ON schedule(employee_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule(date);`);

    // Create default admin user (password: admin123)
    const adminExists = await query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminExists.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await query(
        'INSERT INTO users (username, password, full_name, role) VALUES ($1, $2, $3, $4)',
        ['admin', hashedPassword, 'Адміністратор', 'admin']
      );
      console.log('✅ Default admin user created (username: admin, password: admin123)');
    }

    console.log('✅ Database initialized successfully');
    return pool;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

export default pool;

