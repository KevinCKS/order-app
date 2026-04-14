import { useState } from 'react'
import { AdminPage } from './AdminPage.jsx'
import { OrderPage } from './OrderPage.jsx'
import './App.css'

function App() {
  const [page, setPage] = useState('order')

  return (
    <div className="page">
      <header className="topNav">
        <div className="brand">COZY - 커피 주문 앱</div>
        <nav className="tabs" aria-label="화면 이동">
          <button
            className={`tab${page === 'order' ? ' isActive' : ''}`}
            type="button"
            aria-current={page === 'order' ? 'page' : undefined}
            onClick={() => setPage('order')}
          >
            주문하기
          </button>
          <button
            className={`tab${page === 'admin' ? ' isActive' : ''}`}
            type="button"
            aria-current={page === 'admin' ? 'page' : undefined}
            onClick={() => setPage('admin')}
          >
            관리자
          </button>
        </nav>
      </header>

      {page === 'order' ? <OrderPage /> : <AdminPage />}
    </div>
  )
}

export default App
