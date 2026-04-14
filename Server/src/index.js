import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { registerApiRoutes } from './apiRoutes.js';
import { pool, testDbConnection } from './db.js';
import { ensureSchema } from './schema.js';
import { seedIfEmpty } from './seed.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    credentials: true,
  })
);
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    service: 'order-app-server',
    message: '백엔드 API입니다. 프론트는 UI/app 에서 npm run dev 로 실행하세요.',
    health: '/health',
    api: ['/api/menus', '/api/orders', '/api/admin'],
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

registerApiRoutes(app, pool);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || '서버 오류' });
});

async function bootstrap() {
  try {
    const info = await testDbConnection();
    console.log(
      `PostgreSQL 연결 성공 (database=${info.db}, user=${info.db_user})`
    );
    await ensureSchema(pool);
    await seedIfEmpty(pool);
  } catch (err) {
    console.error('PostgreSQL 연결 실패:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`서버 실행: http://localhost:${PORT}`);
  });
}

bootstrap();

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
