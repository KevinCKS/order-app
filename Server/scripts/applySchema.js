import 'dotenv/config';
import pg from 'pg';
import { ensureSchema } from '../src/schema.js';

const { Pool } = pg;

function shouldUseSsl() {
  const sslMode = (process.env.PGSSLMODE || '').toLowerCase();
  if (sslMode === 'disable') return false;
  if (sslMode === 'require') return true;
  const host = (process.env.PGHOST || '').toLowerCase();
  if (host.includes('render.com')) return true;
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')) return true;
  return false;
}

function buildPoolConfig() {
  const useSsl = shouldUseSsl();
  const ssl = useSsl ? { rejectUnauthorized: false } : undefined;

  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl };
  }

  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl,
  };
}

async function main() {
  const pool = new Pool(buildPoolConfig());
  try {
    const info = await pool.query(
      'SELECT current_database() AS db, current_user AS db_user, NOW() AS server_time'
    );
    console.log(
      `DB 접속 성공 (database=${info.rows[0].db}, user=${info.rows[0].db_user})`
    );
    await ensureSchema(pool);
    console.log('스키마 생성 완료 (menus/options/orders/order_items)');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

