// src/contexts/LangContext.jsx — 全局中英语言切换
import { createContext, useContext, useState } from 'react'

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'zh')
  const toggle = () => setLang(l => {
    const next = l === 'zh' ? 'en' : 'zh'
    localStorage.setItem('lang', next)
    return next
  })
  return <LangContext.Provider value={{ lang, toggle }}>{children}</LangContext.Provider>
}

export function useLang() { return useContext(LangContext) }
