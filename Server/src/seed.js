/** 메뉴·옵션 시드(테이블이 비어 있을 때만) */
export async function seedIfEmpty(pool) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM menus');
  if (rows[0].c > 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const menus = [
      {
        name: '아메리카노(ICE)',
        description: '깔끔하고 시원한 아메리카노',
        price: 4000,
        image_url: '/menu/americano-ice.jpg',
        stock: 30,
        options: [
          { name: '샷 추가', price_delta: 500 },
          { name: '시럽 추가', price_delta: 0 },
        ],
      },
      {
        name: '아메리카노(HOT)',
        description: '진한 향의 따뜻한 아메리카노',
        price: 4000,
        image_url: '/menu/americano-hot.jpg',
        stock: 30,
        options: [
          { name: '샷 추가', price_delta: 500 },
          { name: '시럽 추가', price_delta: 0 },
        ],
      },
      {
        name: '카페라떼',
        description: '부드러운 우유 거품과 에스프레소',
        price: 5000,
        image_url: '/menu/caffe-latte.jpg',
        stock: 25,
        options: [
          { name: '샷 추가', price_delta: 500 },
          { name: '바닐라 시럽', price_delta: 300 },
        ],
      },
    ];

    for (const m of menus) {
      const ins = await client.query(
        `INSERT INTO menus (name, description, price, image_url, stock)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [m.name, m.description, m.price, m.image_url, m.stock]
      );
      const menuId = ins.rows[0].id;
      for (const o of m.options) {
        await client.query(
          `INSERT INTO options (menu_id, name, price_delta) VALUES ($1, $2, $3)`,
          [menuId, o.name, o.price_delta]
        );
      }
    }

    await client.query('COMMIT');
    console.log('시드 데이터: 메뉴·옵션 삽입 완료');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
