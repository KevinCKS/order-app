/** Vite dev 서버가 /api 를 백엔드(3000)로 프록시 */

async function parseJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

export async function fetchMenus() {
  const res = await fetch('/api/menus');
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.error || `메뉴 조회 실패 (${res.status})`);
  }
  return data;
}

export async function createOrder(items) {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.error || `주문 실패 (${res.status})`);
  }
  return data;
}

export async function fetchAdminSummary() {
  const res = await fetch('/api/admin/summary');
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '요약 조회 실패');
  return data;
}

export async function fetchAdminMenus() {
  const res = await fetch('/api/admin/menus');
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '메뉴(관리자) 조회 실패');
  return data;
}

export async function fetchAdminOrders() {
  const res = await fetch('/api/admin/orders');
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '주문 목록 조회 실패');
  return data;
}

export async function advanceOrder(orderId) {
  const res = await fetch(`/api/admin/orders/${orderId}/advance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '상태 변경 실패');
  return data;
}

export async function patchMenuStock(menuId, delta) {
  const res = await fetch(`/api/admin/menus/${menuId}/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '재고 변경 실패');
  return data;
}
