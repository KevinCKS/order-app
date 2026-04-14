import pg from 'pg';

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

export function buildPoolConfig() {
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

export const pool = new Pool(buildPoolConfig());

/** DB 연결 및 간단 쿼리 확인 */
export async function testDbConnection() {
  const result = await pool.query(
    'SELECT current_database() AS db, current_user AS db_user, NOW() AS server_time'
  );
  return result.rows[0];
}
