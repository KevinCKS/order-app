import { useMemo, useState } from 'react'
import './App.css'

const MENU = [
  {
    id: 'ame-ice',
    name: '아메리카노(ICE)',
    price: 4000,
    description: '깔끔하고 시원한 아메리카노',
    imageSrc: '/menu/americano-ice.jpg',
    options: [
      { id: 'shot', label: '샷 추가', priceDelta: 500 },
      { id: 'syrup', label: '시럽 추가', priceDelta: 0 },
    ],
  },
  {
    id: 'ame-hot',
    name: '아메리카노(HOT)',
    price: 4000,
    description: '진한 향의 따뜻한 아메리카노',
    imageSrc: '/menu/americano-hot.jpg',
    options: [
      { id: 'shot', label: '샷 추가', priceDelta: 500 },
      { id: 'syrup', label: '시럽 추가', priceDelta: 0 },
    ],
  },
  {
    id: 'latte',
    name: '카페라떼',
    price: 5000,
    description: '부드러운 우유 거품과 에스프레소',
    imageSrc: '/menu/caffe-latte.jpg',
    options: [
      { id: 'shot', label: '샷 추가', priceDelta: 500 },
      { id: 'vanilla', label: '바닐라 시럽', priceDelta: 300 },
    ],
  },
]

function formatWon(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`
}

function getOptionSignature(optionIds) {
  return optionIds.slice().sort().join('|')
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
      <img className="thumb" src={item.imageSrc} alt={`${item.name} 이미지`} />
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
              <span className="optLabel">{opt.label}</span>
              <span className="optPrice">
                ({opt.priceDelta >= 0 ? '+' : ''}
                {formatWon(opt.priceDelta)})
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      <div className="menuFooter">
        <button className="btnPrimary" onClick={() => onAdd(item, selectedIds)}>
          담기
        </button>
        <div className="unitHint">선택 적용 단가: {formatWon(unitPrice)}</div>
      </div>
    </article>
  )
}

function App() {
  const [cart, setCart] = useState([])

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
            optionIds: optionIds.slice().sort(),
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

  const placeOrder = () => {
    if (cart.length === 0) return
    // 1단계: 주문 API 연결 전이므로 UI 확인용 처리
    window.alert('주문이 완료되었습니다.')
    setCart([])
  }

  const optionLabelMap = useMemo(() => {
    const map = new Map()
    for (const m of MENU) {
      for (const opt of m.options) map.set(`${m.id}:${opt.id}`, opt.label)
    }
    return map
  }, [])

  return (
    <div className="page">
      <header className="topNav">
        <div className="brand">COZY - 커피 주문 앱</div>
        <nav className="tabs" aria-label="화면 이동">
          <button className="tab isActive" aria-current="page" type="button">
            주문하기
          </button>
          <button className="tab" type="button" disabled>
            관리자
          </button>
        </nav>
      </header>

      <main className="content">
        <section className="menuGrid" aria-label="메뉴 목록">
          {MENU.map((item) => (
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
                              .map((id) =>
                                optionLabelMap.get(`${row.menuId}:${id}`),
                              )
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
                    onClick={placeOrder}
                    disabled={cart.length === 0}
                  >
                    주문하기
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
