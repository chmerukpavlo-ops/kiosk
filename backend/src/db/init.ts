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
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'seller', 'manager', 'accountant')),
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

    // Додати поля для знижок до products якщо не існують
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'discount_percent'
        ) THEN
          ALTER TABLE products ADD COLUMN discount_percent DECIMAL(5, 2) DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'discount_start_date'
        ) THEN
          ALTER TABLE products ADD COLUMN discount_start_date DATE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'discount_end_date'
        ) THEN
          ALTER TABLE products ADD COLUMN discount_end_date DATE;
        END IF;
      END $$;
    `);

    // Low-stock settings for products (thresholds + auto reorder)
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'low_stock_threshold'
        ) THEN
          ALTER TABLE products ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 5;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'target_stock_level'
        ) THEN
          ALTER TABLE products ADD COLUMN target_stock_level INTEGER NOT NULL DEFAULT 10;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'products' AND column_name = 'auto_reorder'
        ) THEN
          ALTER TABLE products ADD COLUMN auto_reorder BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
      END $$;
    `);

    // Stock alerts (anti-spam + tracking)
    await query(`
      CREATE TABLE IF NOT EXISTS stock_alerts (
        id SERIAL PRIMARY KEY,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        kiosk_id INTEGER REFERENCES kiosks(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
        threshold INTEGER NOT NULL,
        quantity_at_trigger INTEGER NOT NULL,
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        last_notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // One active alert per (product,kiosk)
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_alerts_active_unique
      ON stock_alerts(product_id, kiosk_id)
      WHERE status = 'active';
    `);

    // Purchase orders (auto-generated drafts for low stock)
    await query(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        kiosk_id INTEGER REFERENCES kiosks(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled', 'received')),
        auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        current_qty INTEGER NOT NULL,
        threshold INTEGER NOT NULL,
        target_level INTEGER NOT NULL,
        recommended_qty INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (order_id, product_id)
      );
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_purchase_orders_kiosk_status ON purchase_orders(kiosk_id, status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(order_id);`);

    // Створити таблицю витрат
    await query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        kiosk_id INTEGER REFERENCES kiosks(id) ON DELETE CASCADE,
        category VARCHAR(50) NOT NULL CHECK (category IN ('rent', 'purchase', 'utilities', 'advertising', 'salary', 'other')),
        description TEXT,
        amount DECIMAL(10, 2) NOT NULL,
        date DATE NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Planned expenses support (status + planned date + paid date + recurrence)
    await query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'expenses' AND column_name = 'status'
        ) THEN
          ALTER TABLE expenses
          ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'paid'
          CHECK (status IN ('paid', 'planned', 'cancelled'));
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'expenses' AND column_name = 'planned_for'
        ) THEN
          ALTER TABLE expenses ADD COLUMN planned_for DATE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'expenses' AND column_name = 'paid_at'
        ) THEN
          ALTER TABLE expenses ADD COLUMN paid_at DATE;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'expenses' AND column_name = 'recurrence'
        ) THEN
          ALTER TABLE expenses
          ADD COLUMN recurrence VARCHAR(20) NOT NULL DEFAULT 'none'
          CHECK (recurrence IN ('none', 'monthly'));
        END IF;
      END $$;
    `);

    // Backfill paid_at for existing (paid) expenses
    await query(`
      UPDATE expenses
      SET paid_at = date
      WHERE paid_at IS NULL AND COALESCE(status, 'paid') = 'paid';
    `);

    // Міграція: розширення категорій витрат
    await query(`
      DO $$ 
      BEGIN
        -- Якщо таблиця існує, оновити CHECK constraint
        IF EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'expenses'
        ) THEN
          -- Видалити старий constraint якщо він існує
          ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check;
          -- Додати новий constraint з розширеними категоріями
          ALTER TABLE expenses ADD CONSTRAINT expenses_category_check 
            CHECK (category IN ('rent', 'purchase', 'utilities', 'advertising', 'salary', 'other'));
        END IF;
      END $$;
    `);

    // Індекси для expenses
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_kiosk ON expenses(kiosk_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);`);

    // Create indexes
    await query(`CREATE INDEX IF NOT EXISTS idx_products_kiosk ON products(kiosk_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(kiosk_id, quantity, low_stock_threshold);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_seller ON sales(seller_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_kiosk ON sales(kiosk_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_schedule_employee ON schedule(employee_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_schedule_date ON schedule(date);`);

    // Bootstrap: create alerts and draft orders for already-low items (so admin sees them immediately)
    await query(`
      INSERT INTO stock_alerts (product_id, kiosk_id, status, threshold, quantity_at_trigger, triggered_at, last_notified_at)
      SELECT
        p.id,
        p.kiosk_id,
        'active',
        COALESCE(p.low_stock_threshold, 5),
        p.quantity,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM products p
      WHERE p.kiosk_id IS NOT NULL
        AND p.quantity <= COALESCE(p.low_stock_threshold, 5)
      ON CONFLICT (product_id, kiosk_id) WHERE status = 'active'
      DO NOTHING;
    `);

    await query(`
      INSERT INTO purchase_orders (kiosk_id, status, auto_generated)
      SELECT DISTINCT
        p.kiosk_id,
        'draft',
        TRUE
      FROM products p
      WHERE p.kiosk_id IS NOT NULL
        AND COALESCE(p.auto_reorder, FALSE) = TRUE
        AND p.quantity <= COALESCE(p.low_stock_threshold, 5)
        AND NOT EXISTS (
          SELECT 1 FROM purchase_orders po
          WHERE po.kiosk_id = p.kiosk_id
            AND po.status = 'draft'
            AND po.auto_generated = TRUE
        );
    `);

    await query(`
      INSERT INTO purchase_order_items (order_id, product_id, current_qty, threshold, target_level, recommended_qty)
      SELECT
        po.id as order_id,
        p.id as product_id,
        p.quantity as current_qty,
        COALESCE(p.low_stock_threshold, 5) as threshold,
        GREATEST(COALESCE(p.target_stock_level, 10), COALESCE(p.low_stock_threshold, 5)) as target_level,
        GREATEST(0, GREATEST(COALESCE(p.target_stock_level, 10), COALESCE(p.low_stock_threshold, 5)) - p.quantity) as recommended_qty
      FROM purchase_orders po
      JOIN products p ON p.kiosk_id = po.kiosk_id
      WHERE po.status = 'draft'
        AND po.auto_generated = TRUE
        AND p.kiosk_id IS NOT NULL
        AND COALESCE(p.auto_reorder, FALSE) = TRUE
        AND p.quantity <= COALESCE(p.low_stock_threshold, 5)
      ON CONFLICT (order_id, product_id)
      DO UPDATE SET
        current_qty = EXCLUDED.current_qty,
        threshold = EXCLUDED.threshold,
        target_level = EXCLUDED.target_level,
        recommended_qty = EXCLUDED.recommended_qty,
        updated_at = CURRENT_TIMESTAMP;
    `);

    // Inventory tables
    await query(`
      CREATE TABLE IF NOT EXISTS inventory (
        id SERIAL PRIMARY KEY,
        kiosk_id INTEGER REFERENCES kiosks(id) ON DELETE CASCADE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
        system_quantity INTEGER NOT NULL,
        actual_quantity INTEGER,
        difference INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Customers table
    await query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        notes TEXT,
        total_purchases DECIMAL(10, 2) DEFAULT 0,
        total_visits INTEGER DEFAULT 0,
        last_visit TIMESTAMP,
        loyalty_points INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add customer_id to sales if not exists
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'sales' AND column_name = 'customer_id'
        ) THEN
          ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Action logs table for tracking admin actions
    await query(`
      CREATE TABLE IF NOT EXISTS action_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action_type VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER,
        description TEXT,
        changes JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_action_logs_user ON action_logs(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_action_logs_entity ON action_logs(entity_type, entity_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_action_logs_created ON action_logs(created_at DESC);`);

    // Gamification: Achievements and badges
    await query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        points INTEGER DEFAULT 0,
        category VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, achievement_id)
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS daily_goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        sales_target INTEGER DEFAULT 0,
        revenue_target DECIMAL(10, 2) DEFAULT 0,
        sales_actual INTEGER DEFAULT 0,
        revenue_actual DECIMAL(10, 2) DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, date)
      );
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_daily_goals_user_date ON daily_goals(user_id, date DESC);`);

    // Insert default achievements
    await query(`
      INSERT INTO achievements (code, name, description, icon, points, category)
      VALUES
        ('first_sale', 'Перший продаж', 'Зробіть свій перший продаж', '🎯', 10, 'sales'),
        ('sales_10', '10 продажів', 'Зробіть 10 продажів за день', '🔥', 25, 'sales'),
        ('sales_50', '50 продажів', 'Зробіть 50 продажів за день', '💪', 50, 'sales'),
        ('sales_100', '100 продажів', 'Зробіть 100 продажів за день', '🏆', 100, 'sales'),
        ('revenue_1000', '1000₴ виручки', 'Досягніть 1000₴ виручки за день', '💰', 30, 'revenue'),
        ('revenue_5000', '5000₴ виручки', 'Досягніть 5000₴ виручки за день', '💎', 75, 'revenue'),
        ('revenue_10000', '10000₴ виручки', 'Досягніть 10000₴ виручки за день', '👑', 150, 'revenue'),
        ('week_streak', 'Тиждень підряд', 'Працюйте 7 днів підряд', '📅', 50, 'streak'),
        ('month_streak', 'Місяць підряд', 'Працюйте 30 днів підряд', '⭐', 200, 'streak'),
        ('top_seller', 'Топ продавець', 'Станьте найкращим продавцем дня', '🥇', 100, 'ranking')
      ON CONFLICT (code) DO NOTHING;
    `);

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

