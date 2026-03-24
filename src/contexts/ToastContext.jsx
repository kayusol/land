import React, {useEffect,  createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)
export const useToast = () => useContext(Ctx)

let _n = 0
export function ToastProvider({ children }) {
  const [list, setList] = useState([])
  const rm = useCallback((id) => setList(l => l.filter(x => x.id !== id)), [])
  const add = useCallback((type, title, msg, ms = 4000) => {
    const id = ++_n
    setList(l => [...l.slice(-4), { id, type, title, msg }])
    if (ms > 0) setTimeout(() => rm(id), ms)
  }, [rm])
  const toast = {
    ok:   (t, m) => add('ok',   t, m),
    err:  (t, m) => add('err',  t, m, 6000),
    info: (t, m) => add('info', t, m),
  }
  return <Ctx.Provider value={{ toast, list, rm }}>{children}</Ctx.Provider>
}
