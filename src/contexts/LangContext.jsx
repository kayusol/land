// src/contexts/LangContext.jsx — 全局中英语言切换 + t() 便捷函数
import { createContext, useContext, useState, useCallback } from 'react'
import { getText } from '../i18n/index.js'

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'zh')

  const toggle = () => setLang(l => {
    const next = l === 'zh' ? 'en' : 'zh'
    localStorage.setItem('lang', next)
    return next
  })

  // t('market.title') → 根据当前语言返回文本
  // t('zh文本', 'en text') → 直接传双语字符串（兼容旧写法）
  const t = useCallback((zhOrKey, en) => {
    if (en !== undefined) {
      // 直接传 zh/en 字符串用法: t('加载中', 'Loading')
      return lang === 'zh' ? zhOrKey : en
    }
    // i18n key 用法: t('market.title')
    return getText(lang, zhOrKey)
  }, [lang])

  return (
    <LangContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() { return useContext(LangContext) }
