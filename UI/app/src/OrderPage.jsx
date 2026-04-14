import { useCallback, useEffect, useMemo, useState } from 'react'
import { createOrder, fetchMenus } from './api.js'

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`
}

function getOptionSignature(optionIds) {
  return optionIds.slice().sort((a, b) => a - b).join('|')
}

function calcUnitPrice(menuItem, optionIds) {
  const optionSet = new Set(optionIds)
  const extra = menuItem.options.reduce(
    (sum, opt) => (optionSet.has(opt.id) ? sum + opt.priceDelta : sum),
    0,
  )
  return menuItem.price + extra
}

function MenuCard({ item, onAdd }) {
  const [selected, setSelected] = useState(() => new Set())

  const toggle = (optionId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
  }

  const selectedIds = useMemo(() => Array.from(selected), [selected])
  const unitPrice = calcUnitPrice(item, selectedIds)

  return (
    <article className="menuCard">
      <img
        className="thumb"
        src={item.imageUrl}
        alt={`${item.name} 이미지`}
      />
      <div className="menuBody">
        <div className="menuTitleRow">
          <h3 className="menuTitle">{item.name}</h3>
          <div className="menuPrice">{formatWon(item.price)}</div>
        </div>
        <p className="menuDesc">{item.description}</p>
        <fieldset className="options">
          <legend className="srOnly">옵션</legend>
          {item.options.map((opt) => (
            <label key={opt.id} className="optRow">
              <input
                type="checkbox"
                checked={selected.has(opt.id)}
                onChange={() => toggle(opt.id)}
              />
              <span className="optLabel">{opt.name}</span>
              <span className="optPrice">
                ({opt.priceDelta >= 0 ? '+' : ''}
                {formatWon(opt.priceDelta)})
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="menuFooter">
        <button className="btnPrimary" type="button" onClick={() => onAdd(item, selectedIds)}>
          담기
        </button>
        <div className="unitHint">선택 적용 단가: {formatWon(unitPrice)}</div>
      </div>
    </article>
  )
}

export function OrderPage() {
  const [menus, setMenus] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [cart, setCart] = useState([])
  const [orderSubmitting, setOrderSubmitting] = useState(false)

  const loadMenus = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchMenus()
      setMenus(Array.isArray(data) ? data : [])
    } catch (e) {
      setLoadError(e.message || '메뉴를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMenus()
  }, [loadMenus])

  const total = useMemo(
    () => cart.reduce((sum, row) => sum + row.unitPrice * row.qty, 0),
    [cart],
  )

  const addToCart = (menuItem, optionIds) => {
    const signature = getOptionSignature(optionIds)
    const unitPrice = calcUnitPrice(menuItem, optionIds)

    setCart((prev) => {
      const idx = prev.findIndex(
        (r) => r.menuId === menuItem.id && r.optionSignature === signature,
      )
      if (idx === -1) {
        return [
          ...prev,
          {
            key: `${menuItem.id}::${signature}`,
            menuId: menuItem.id,
            name: menuItem.name,
            optionIds: optionIds.slice().sort((a, b) => a - b),
            optionSignature: signature,
            unitPrice,
            qty: 1,
          },
        ]
      }

      const next = prev.slice()
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
      return next
    })
  }

  const incQty = (rowKey) => {
    setCart((prev) =>
      prev.map((r) => (r.key === rowKey ? { ...r, qty: r.qty + 1 } : r)),
    )
  }

  const decQty = (rowKey) => {
    setCart((prev) =>
      prev.map((r) =>
        r.key === rowKey ? { ...r, qty: Math.max(1, r.qty - 1) } : r,
      ),
    )
  }

  const removeRow = (rowKey) => {
    setCart((prev) => prev.filter((r) => r.key !== rowKey))
  }

  const placeOrder = async () => {
    if (cart.length === 0 || orderSubmitting) return
    setOrderSubmitting(true)
    try {
      const payload = cart.map((row) => ({
        menuId: row.menuId,
        qty: row.qty,
        optionIds: row.optionIds,
      }))
      const result = await createOrder(payload)
      window.alert(`주문이 접수되었습니다.\n주문 번호: ${result.id}`)
      setCart([])
    } catch (e) {
      window.alert(e.message || '주문에 실패했습니다.')
    } finally {
      setOrderSubmitting(false)
    }
  }

  const optionLabelMap = useMemo(() => {
    const map = new Map()
    for (const m of menus) {
      for (const opt of m.options) {
        map.set(`${m.id}:${opt.id}`, opt.name)
      }
    }
    return map
  }, [menus])

  return (
    <main className="content">
      <section className="menuGrid" aria-label="메뉴 목록">
        {loading && (
          <div className="menuLoading" style={{ gridColumn: '1 / -1' }}>
            메뉴를 불러오는 중입니다…
          </div>
        )}
        {!loading && loadError && (
          <div className="errorBanner" style={{ gridColumn: '1 / -1' }}>
            <div>{loadError}</div>
            <button className="btnPrimary" type="button" onClick={loadMenus}>
              다시 시도
            </button>
          </div>
        )}
        {!loading &&
          !loadError &&
          menus.map((item) => (
            <MenuCard key={item.id} item={item} onAdd={addToCart} />
          ))}
      </section>

      <section className="cartPanel" aria-label="장바구니">
        <div className="cartHeader">
          <h2 className="cartTitle">장바구니</h2>
        </div>
        <div className="cartBody">
          <div className="cartSplit">
            <div className="cartLeftPane">
              {cart.length === 0 ? (
                <div className="empty">담긴 메뉴가 없습니다.</div>
              ) : (
                <ul className="cartList">
                  {cart.map((row) => {
                    const optLabels =
                      row.optionIds.length === 0
                        ? ''
                        : ` (${row.optionIds
                            .map((id) => optionLabelMap.get(`${row.menuId}:${id}`))
                            .filter(Boolean)
                            .join(', ')})`
                    const lineTotal = row.unitPrice * row.qty
                    return (
                      <li key={row.key} className="cartRow">
                        <div className="cartLeft">
                          <div className="cartName">
                            {row.name}
                            {optLabels}
                          </div>
                          <div className="cartMeta">
                            <div className="qtyControls" aria-label="수량 조절">
                              <button
                                className="qtyBtn"
                                type="button"
                                onClick={() => decQty(row.key)}
                                disabled={row.qty <= 1}
                                aria-label="수량 감소"
                              >
                                -
                              </button>
                              <div className="qtyValue" aria-label="수량">
                                x {row.qty}
                              </div>
                              <button
                                className="qtyBtn"
                                type="button"
                                onClick={() => incQty(row.key)}
                                aria-label="수량 증가"
                              >
                                +
                              </button>
                              <button
                                className="qtyRemove"
                                type="button"
                                onClick={() => removeRow(row.key)}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="cartRight">{formatWon(lineTotal)}</div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <aside className="cartRightPane" aria-label="결제 요약">
              <div className="cartSummary">
                <div className="sumLabel">총 금액</div>
                <div className="sumValue">{formatWon(total)}</div>
                <button
                  className="btnPrimary"
                  type="button"
                  onClick={placeOrder}
                  disabled={cart.length === 0 || orderSubmitting || !!loadError}
                >
                  {orderSubmitting ? '주문 처리 중…' : '주문하기'}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
