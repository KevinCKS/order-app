/**
 * REST API: 메뉴, 주문, 관리자
 */

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function mapMenuRow(m) {
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    price: m.price,
    imageUrl: m.image_url,
    ...(m.stock !== undefined ? { stock: m.stock } : {}),
  };
}

export function registerApiRoutes(app, pool) {
  /** 공개: 메뉴 + 옵션 (재고 제외) */
  app.get(
    '/api/menus',
    asyncHandler(async (_req, res) => {
      const menusRes = await pool.query(
        `SELECT id, name, description, price, image_url FROM menus ORDER BY id`
      );
      const optRes = await pool.query(
        `SELECT id, menu_id, name, price_delta FROM options ORDER BY menu_id, id`
      );
      const byMenu = new Map();
      for (const m of menusRes.rows) {
        byMenu.set(m.id, { ...mapMenuRow(m), options: [] });
      }
      for (const o of optRes.rows) {
        const menu = byMenu.get(o.menu_id);
        if (menu) {
          menu.options.push({
            id: o.id,
            name: o.name,
            priceDelta: o.price_delta,
          });
        }
      }
      res.json([...byMenu.values()]);
    })
  );

  /** 관리자: 메뉴 + 재고 */
  app.get(
    '/api/admin/menus',
    asyncHandler(async (_req, res) => {
      const menusRes = await pool.query(
        `SELECT id, name, description, price, image_url, stock FROM menus ORDER BY id`
      );
      const optRes = await pool.query(
        `SELECT id, menu_id, name, price_delta FROM options ORDER BY menu_id, id`
      );
      const byMenu = new Map();
      for (const m of menusRes.rows) {
        byMenu.set(m.id, { ...mapMenuRow(m), stock: m.stock, options: [] });
      }
      for (const o of optRes.rows) {
        const menu = byMenu.get(o.menu_id);
        if (menu) {
          menu.options.push({
            id: o.id,
            name: o.name,
            priceDelta: o.price_delta,
          });
        }
      }
      res.json([...byMenu.values()]);
    })
  );

  /** 재고 증감: delta +1 / -1 */
  app.patch(
    '/api/admin/menus/:menuId/stock',
    asyncHandler(async (req, res) => {
      const menuId = Number(req.params.menuId);
      const delta = Number(req.body?.delta);
      if (!Number.isInteger(menuId) || menuId < 1) {
        return res.status(400).json({ error: '잘못된 menuId' });
      }
      if (delta !== 1 && delta !== -1) {
        return res.status(400).json({ error: 'delta는 1 또는 -1만 허용' });
      }
      const r = await pool.query(
        `UPDATE menus
         SET stock = GREATEST(0, stock + $1)
         WHERE id = $2
         RETURNING id, stock`,
        [delta, menuId]
      );
      if (r.rowCount === 0) {
        return res.status(404).json({ error: '메뉴를 찾을 수 없습니다.' });
      }
      res.json({ id: r.rows[0].id, stock: r.rows[0].stock });
    })
  );

  /** 대시보드 집계 */
  app.get(
    '/api/admin/summary',
    asyncHandler(async (_req, res) => {
      const r = await pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'received')::int AS received,
          COUNT(*) FILTER (WHERE status = 'making')::int AS making,
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
        FROM orders
      `);
      res.json(r.rows[0]);
    })
  );

  /** 관리자 주문 목록 */
  app.get(
    '/api/admin/orders',
    asyncHandler(async (_req, res) => {
      const ordersRes = await pool.query(
        `SELECT id, created_at, status, total_amount FROM orders ORDER BY created_at DESC LIMIT 200`
      );
      const ids = ordersRes.rows.map((o) => o.id);
      if (ids.length === 0) {
        return res.json([]);
      }
      const itemsRes = await pool.query(
        `SELECT order_id, menu_name_snapshot, qty, line_total
         FROM order_items WHERE order_id = ANY($1::int[])`,
        [ids]
      );
      const byOrder = new Map();
      for (const o of ordersRes.rows) {
        byOrder.set(o.id, {
          id: o.id,
          createdAt: o.created_at,
          status: o.status,
          totalAmount: o.total_amount,
          summaryParts: [],
        });
      }
      for (const it of itemsRes.rows) {
        const row = byOrder.get(it.order_id);
        if (row) {
          row.summaryParts.push(`${it.menu_name_snapshot} × ${it.qty}`);
        }
      }
      const out = ordersRes.rows.map((o) => {
        const r = byOrder.get(o.id);
        return {
          id: r.id,
          createdAt: r.createdAt,
          status: r.status,
          totalAmount: r.totalAmount,
          summary: r.summaryParts.join(', '),
        };
      });
      res.json(out);
    })
  );

  /** 주문 생성 + 재고 차감 */
  app.post(
    '/api/orders',
    asyncHandler(async (req, res) => {
      const items = req.body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items가 비어 있습니다.' });
      }

      const client = await pool.connect();
      let txStarted = false;
      try {
        await client.query('BEGIN');
        txStarted = true;

        const optionRows = await client.query(
          `SELECT id, menu_id, name, price_delta FROM options`
        );
        const optById = new Map(optionRows.rows.map((o) => [o.id, o]));

        const menuRows = await client.query(
          `SELECT id, name, price, stock FROM menus FOR UPDATE`
        );
        const menuById = new Map(menuRows.rows.map((m) => [m.id, m]));

        let totalAmount = 0;
        const lines = [];

        const menuQtyNeed = new Map();
        for (const raw of items) {
          const menuId = Number(raw.menuId);
          const qty = Number(raw.qty);
          const optionIds = Array.isArray(raw.optionIds) ? raw.optionIds.map(Number) : [];
          if (!Number.isInteger(menuId) || menuId < 1) {
            throw Object.assign(new Error('잘못된 menuId'), { status: 400 });
          }
          if (!Number.isInteger(qty) || qty < 1) {
            throw Object.assign(new Error('잘못된 수량'), { status: 400 });
          }
          const uniqOpt = [...new Set(optionIds)];
          if (uniqOpt.length !== optionIds.length) {
            throw Object.assign(new Error('옵션 ID가 중복되었습니다.'), { status: 400 });
          }
          const menu = menuById.get(menuId);
          if (!menu) {
            throw Object.assign(new Error('메뉴를 찾을 수 없습니다.'), { status: 400 });
          }
          for (const oid of optionIds) {
            const o = optById.get(oid);
            if (!o || o.menu_id !== menuId) {
              throw Object.assign(new Error('옵션이 메뉴와 맞지 않습니다.'), { status: 400 });
            }
          }
          let extra = 0;
          const snapshot = [];
          for (const oid of optionIds) {
            const o = optById.get(oid);
            extra += o.price_delta;
            snapshot.push({
              id: o.id,
              name: o.name,
              priceDelta: o.price_delta,
            });
          }
          const unitPrice = menu.price + extra;
          const lineTotal = unitPrice * qty;
          totalAmount += lineTotal;
          lines.push({
            menuId,
            menuName: menu.name,
            qty,
            unitPrice,
            lineTotal,
            optionsSnapshot: snapshot,
          });
          menuQtyNeed.set(menuId, (menuQtyNeed.get(menuId) || 0) + qty);
        }

        for (const [menuId, need] of menuQtyNeed) {
          const m = menuById.get(menuId);
          if (m.stock < need) {
            throw Object.assign(
              new Error(`재고 부족: 메뉴 "${m.name}" (필요 ${need}, 재고 ${m.stock})`),
              { status: 409 }
            );
          }
        }

        const orderIns = await client.query(
          `INSERT INTO orders (status, total_amount) VALUES ('received', $1) RETURNING id, created_at`,
          [totalAmount]
        );
        const orderId = orderIns.rows[0].id;

        for (const line of lines) {
          await client.query(
            `INSERT INTO order_items (order_id, menu_id, menu_name_snapshot, qty, unit_price, line_total, options_snapshot)
             VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
            [
              orderId,
              line.menuId,
              line.menuName,
              line.qty,
              line.unitPrice,
              line.lineTotal,
              JSON.stringify(line.optionsSnapshot),
            ]
          );
        }

        for (const [menuId, need] of menuQtyNeed) {
          await client.query(`UPDATE menus SET stock = stock - $1 WHERE id = $2`, [
            need,
            menuId,
          ]);
        }

        await client.query('COMMIT');
        txStarted = false;
        res.status(201).json({
          id: orderId,
          createdAt: orderIns.rows[0].created_at,
          totalAmount,
          status: 'received',
        });
      } catch (e) {
        if (txStarted) {
          await client.query('ROLLBACK');
        }
        if (e.status) {
          return res.status(e.status).json({ error: e.message });
        }
        throw e;
      } finally {
        client.release();
      }
    })
  );

  /** 주문 단건 (상세) */
  app.get(
    '/api/orders/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: '잘못된 주문 ID' });
      }
      const oRes = await pool.query(
        `SELECT id, created_at, status, total_amount FROM orders WHERE id = $1`,
        [id]
      );
      if (oRes.rowCount === 0) {
        return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
      }
      const o = oRes.rows[0];
      const itemsRes = await pool.query(
        `SELECT menu_id, menu_name_snapshot, qty, unit_price, line_total, options_snapshot
         FROM order_items WHERE order_id = $1 ORDER BY id`,
        [id]
      );
      res.json({
        id: o.id,
        createdAt: o.created_at,
        status: o.status,
        totalAmount: o.total_amount,
        items: itemsRes.rows.map((it) => ({
          menuId: it.menu_id,
          menuName: it.menu_name_snapshot,
          qty: it.qty,
          unitPrice: it.unit_price,
          lineTotal: it.line_total,
          options: it.options_snapshot,
        })),
      });
    })
  );

  /** 주문 상태 한 단계 진행: received → making → completed */
  app.post(
    '/api/admin/orders/:id/advance',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: '잘못된 주문 ID' });
      }
      const cur = await pool.query(`SELECT id, status FROM orders WHERE id = $1`, [id]);
      if (cur.rowCount === 0) {
        return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
      }
      const s = cur.rows[0].status;
      let next = s;
      if (s === 'received') next = 'making';
      else if (s === 'making') next = 'completed';
      else {
        return res.json({ id, status: s, message: '이미 완료된 주문입니다.' });
      }
      const u = await pool.query(
        `UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status`,
        [next, id]
      );
      res.json({ id: u.rows[0].id, status: u.rows[0].status });
    })
  );
}
