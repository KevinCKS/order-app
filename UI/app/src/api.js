/** Vite dev 서버가 /api 를 백엔드(3000)로 프록시 */

function getApiBaseUrl() {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!raw) return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function apiUrl(path) {
  const base = getApiBaseUrl();
  if (!base) return path; // 개발 환경(Vite proxy) 또는 동일 오리진
  return `${base}${path}`;
}

async function parseJson(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

export async function fetchMenus() {
  const res = await fetch(apiUrl('/api/menus'));
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(data?.error || `메뉴 조회 실패 (${res.status})`);
  }
  return data;
}

export async function createOrder(items) {
  const res = await fetch(apiUrl('/api/orders'), {
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
  const res = await fetch(apiUrl('/api/admin/summary'));
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '요약 조회 실패');
  return data;
}

export async function fetchAdminMenus() {
  const res = await fetch(apiUrl('/api/admin/menus'));
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '메뉴(관리자) 조회 실패');
  return data;
}

export async function fetchAdminOrders() {
  const res = await fetch(apiUrl('/api/admin/orders'));
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '주문 목록 조회 실패');
  return data;
}

export async function advanceOrder(orderId) {
  const res = await fetch(apiUrl(`/api/admin/orders/${orderId}/advance`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '상태 변경 실패');
  return data;
}

export async function patchMenuStock(menuId, delta) {
  const res = await fetch(apiUrl(`/api/admin/menus/${menuId}/stock`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta }),
  });
  const data = await parseJson(res);
  if (!res.ok) throw new Error(data?.error || '재고 변경 실패');
  return data;
}
