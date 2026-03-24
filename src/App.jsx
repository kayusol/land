import React, { useState, useEffect } from 'react'
import TopNav from './components/TopNav.jsx'
import BottomNav from './components/BottomNav.jsx'
import WorldMap from './pages/WorldMap.jsx'
import MarketPage from './pages/MarketPage.jsx'
import FarmPage from './pages/FarmPage.jsx'
import AssetsPage from './pages/AssetsPage.jsx'
import SwapPage from './pages/SwapPage.jsx'
import ReferralPage from './pages/ReferralPage.jsx'
import BlindBoxPage from './pages/BlindBoxPage.jsx'
import ApostlePage from './pages/ApostlePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import Toast from './components/Toast.jsx'
import { ToastProvider } from './contexts/ToastContext.jsx'
import './App.css'

const PAGES = [
  { id: 'map',      zh: '地图',  en: 'Map',      icon: '🌍' },
  { id: 'market',   zh: '市场',  en: 'Market',   icon: '🏛' },
  { id: 'apostle',  zh: '使徒',  en: 'Apostle',  icon: '🧙' },
  { id: 'blindbox', zh: '盲盒',  en: 'BlindBox', icon: '🎁' },
  { id: 'farm',     zh: '农场',  en: 'Farm',     icon: '🌾' },
  { id: 'swap',     zh: '兑换',  en: 'Swap',     icon: '🔄' },
  { id: 'referral', zh: '邀请',  en: 'Referral', icon: '🤝' },
  { id: 'assets',   zh: '资产',  en: 'Assets',   icon: '💎' },
  { id: 'admin',    zh: '管理',  en: 'Admin',    icon: '🛠' },
]

function AppInner() {
  const [page, setPage] = useState('map')
  const [assetTab, setAssetTab] = useState('token')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) { sessionStorage.setItem('pendingRef', ref); setPage('referral') }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.page) setPage(e.detail.page)
      if (e.detail?.tab)  setAssetTab(e.detail.tab)
    }
    window.addEventListener('nav', handler)
    return () => window.removeEventListener('nav', handler)
  }, [])

  const views = {
    map:      <WorldMap />,
    apostle:  <ApostlePage />,
    market:   <MarketPage />,
    blindbox: <BlindBoxPage />,
    farm:     <FarmPage />,
    swap:     <SwapPage />,
    referral: <ReferralPage />,
    assets:   <AssetsPage initialTab={assetTab} />,
    admin:    <AdminPage />,
  }

  return (
    <div className="app-root">
      <TopNav pages={PAGES} current={page} onChange={setPage} />
      <main className="app-main app-main-with-bottom-nav">
        <div className="fade-up" key={page} style={{ height: '100%' }}>
          {views[page]}
        </div>
      </main>
      <BottomNav pages={PAGES} current={page} onChange={setPage} />
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
