import React from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import './TopNav.css'

export default function TopNav({ pages, current, onChange }) {
  return (
    <nav className="top-nav">
      <div className="nav-logo">
        <div className="nav-logo-icon">🌐</div>
        <div className="nav-logo-text">
          <span className="nav-logo-main">進化星球</span>
          <span className="nav-logo-sub">Evolution Land</span>
        </div>
      </div>

      <div className="nav-links">
        {pages.map(p => (
          <button
            key={p.id}
            className={`nav-link${current === p.id ? ' active' : ''}`}
            onClick={() => onChange(p.id)}
          >
            <span className="nl-icon">{p.icon}</span>
            <span className="nl-label">{p.zh}</span>
          </button>
        ))}
      </div>

      <div className="nav-right">
        <ConnectButton chainStatus="icon" showBalance={false} accountStatus="short" />
      </div>
    </nav>
  )
}
