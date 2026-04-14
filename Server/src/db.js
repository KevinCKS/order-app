import pg from 'pg';

const { Pool } = pg;

function buildPoolConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
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
