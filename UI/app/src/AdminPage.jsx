import { useCallback, useEffect, useState } from 'react'
import {
  advanceOrder,
  fetchAdminMenus,
  fetchAdminOrders,
  fetchAdminSummary,
  patchMenuStock,
} from './api.js'

const STATUS_LABEL = {
  received: '주문 접수',
  making: '제조 중',
  completed: '제조 완료',
}

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const [menus, setMenus] = useState([])
  const [orders, setOrders] = useState([])
  const [busyMenuId, setBusyMenuId] = useState(null)
  const [busyOrderId, setBusyOrderId] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, m, o] = await Promise.all([
        fetchAdminSummary(),
        fetchAdminMenus(),
        fetchAdminOrders(),
      ])
      setSummary(s)
      setMenus(Array.isArray(m) ? m : [])
      setOrders(Array.isArray(o) ? o : [])
    } catch (e) {
      setError(e.message || '데이터를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const onStock = async (menuId, delta) => {
    setBusyMenuId(menuId)
    try {
      await patchMenuStock(menuId, delta)
      await loadAll()
    } catch (e) {
      window.alert(e.message || '재고 변경 실패')
    } finally {
      setBusyMenuId(null)
    }
  }

  const onAdvance = async (orderId) => {
    setBusyOrderId(orderId)
    try {
      await advanceOrder(orderId)
      await loadAll()
    } catch (e) {
      window.alert(e.message || '상태 변경 실패')
    } finally {
      setBusyOrderId(null)
    }
  }

  const nextLabel = (status) => {
    if (status === 'received') return '제조 중으로'
    if (status === 'making') return '제조 완료로'
    return '완료됨'
  }

  return (
    <main className="content">
      {loading && <div className="menuLoading">불러오는 중…</div>}
      {!loading && error && (
        <div className="errorBanner">
          <div>{error}</div>
          <button className="btnPrimary" type="button" onClick={loadAll}>
            다시 시도
          </button>
        </div>
      )}
      {!loading && !error && summary && (
        <>
          <section aria-label="관리자 요약">
            <div className="adminSummary">
              <div className="summaryCard">
                <div className="k">총 주문</div>
                <div className="v">{summary.total}</div>
              </div>
              <div className="summaryCard">
                <div className="k">주문 접수</div>
                <div className="v">{summary.received}</div>
              </div>
              <div className="summaryCard">
                <div className="k">제조 중</div>
                <div className="v">{summary.making}</div>
              </div>
              <div className="summaryCard">
                <div className="k">제조 완료</div>
                <div className="v">{summary.completed}</div>
              </div>
            </div>
          </section>

          <section aria-label="재고 현황">
            <h2 className="cartTitle" style={{ marginBottom: 10 }}>
              재고 현황
            </h2>
            <div className="adminStockGrid">
              {menus.map((m) => (
                <div key={m.id} className="stockCard">
                  <div className="stockTitle">{m.name}</div>
                  <div className="stockRow">
                    <div>
                      <span className="muted">재고</span>{' '}
                      <strong>{m.stock}개</strong>
                    </div>
                    <div className="qtyControls">
                      <button
                        className="qtyBtn"
                        type="button"
                        disabled={busyMenuId === m.id || m.stock <= 0}
                        onClick={() => onStock(m.id, -1)}
                        aria-label="재고 감소"
                      >
                        -
                      </button>
                      <button
                        className="qtyBtn"
                        type="button"
                        disabled={busyMenuId === m.id}
                        onClick={() => onStock(m.id, 1)}
                        aria-label="재고 증가"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="주문 현황">
            <h2 className="cartTitle" style={{ margin: '18px 0 10px' }}>
              주문 현황
            </h2>
            <div className="adminOrderList">
              {orders.length === 0 && (
                <div className="adminOrderRow">
                  <div className="muted">주문이 없습니다.</div>
                </div>
              )}
              {orders.map((o) => (
                <div key={o.id} className="adminOrderRow">
                  <div>
                    <div style={{ fontWeight: 800 }}>{formatDate(o.createdAt)}</div>
                    <div className="adminOrderMeta">{o.summary}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 900 }}>
                    {formatWon(o.totalAmount)}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="muted" style={{ marginBottom: 6 }}>
                      {STATUS_LABEL[o.status] || o.status}
                    </div>
                    <button
                      className="btnPrimary"
                      type="button"
                      disabled={
                        o.status === 'completed' || busyOrderId === o.id
                      }
                      onClick={() => onAdvance(o.id)}
                    >
                      {busyOrderId === o.id
                        ? '처리 중…'
                        : nextLabel(o.status)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
