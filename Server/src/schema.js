/** PostgreSQL 테이블 생성 (최초 1회) */
export async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS menus (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price INTEGER NOT NULL CHECK (price >= 0),
      image_url TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
    );

    CREATE TABLE IF NOT EXISTS options (
      id SERIAL PRIMARY KEY,
      menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      price_delta INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status VARCHAR(32) NOT NULL CHECK (status IN ('received', 'making', 'completed')),
      total_amount INTEGER NOT NULL CHECK (total_amount >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_id INTEGER NOT NULL REFERENCES menus(id),
      menu_name_snapshot VARCHAR(255) NOT NULL,
      qty INTEGER NOT NULL CHECK (qty >= 1),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      line_total INTEGER NOT NULL CHECK (line_total >= 0),
      options_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);
}
