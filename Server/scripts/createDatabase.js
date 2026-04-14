import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

/** CREATE DATABASE에 쓸 수 있는 이름만 허용 */
function assertDbName(name) {
  if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(
      `PGDATABASE 값이 올바르지 않습니다(영문, 숫자, 밑줄만 허용): ${name}`
    );
  }
}

function buildAdminClientConfig() {
  const adminDb = process.env.PGADMIN_DATABASE || 'postgres';

  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    u.pathname = `/${adminDb}`;
    return { connectionString: u.toString() };
  }

  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT) || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: adminDb,
  };
}

async function main() {
  const targetName = process.env.PGDATABASE;
  if (!targetName) {
    throw new Error('PGDATABASE 환경 변수가 필요합니다.');
  }
  assertDbName(targetName);

  const client = new Client(buildAdminClientConfig());
  await client.connect();

  try {
    const exists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetName]
    );
    if (exists.rows.length > 0) {
      console.log(`데이터베이스 "${targetName}" 은(는) 이미 있습니다.`);
      return;
    }

    await client.query(`CREATE DATABASE "${targetName}"`);
    console.log(`데이터베이스 "${targetName}" 생성 완료`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
