import React from 'react'
import { useLang } from '../contexts/LangContext.jsx'
import './BottomNav.css'

export default function BottomNav({ pages, current, onChange }) {
  const { lang } = useLang()
  return (
    <nav className="bottom-nav" role="navigation" aria-label="主导航">
      {pages.map(p => (
        <button
          key={p.id}
          type="button"
          className={`bottom-nav-item${current === p.id ? ' active' : ''}`}
          onClick={() => onChange(p.id)}
          aria-current={current === p.id ? 'page' : undefined}
        >
          <span className="bn-icon">{p.icon}</span>
          <span className="bn-label">{lang==='zh' ? p.zh : p.en}</span>
        </button>
      ))}
    </nav>
  )
}
