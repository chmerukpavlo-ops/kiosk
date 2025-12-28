-- Create promotions table for advanced discount system
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('percentage', 'fixed', 'buy_x_get_y', 'bundle')),
  discount_percent DECIMAL(5, 2) CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount DECIMAL(10, 2) CHECK (discount_amount >= 0),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  min_purchase_amount DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  applicable_to VARCHAR(50) CHECK (applicable_to IN ('all', 'category', 'brand', 'products')),
  category_filter VARCHAR(100),
  brand_filter VARCHAR(255),
  product_ids INTEGER[],
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create promotion_products junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS promotion_products (
  promotion_id INTEGER REFERENCES promotions(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_type ON promotions(type);
CREATE INDEX IF NOT EXISTS idx_promotion_products_promotion ON promotion_products(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_products_product ON promotion_products(product_id);

