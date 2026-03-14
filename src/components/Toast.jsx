import React from 'react'
import { useToast } from '../contexts/ToastContext.jsx'

const BORDER = { ok: '#4ade80', err: '#f87171', info: '#60a5fa' }
const ICON   = { ok: '✓', err: '✕', info: 'ℹ' }

export default function Toast() {
  const { list, rm } = useToast()
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {list.map(t => (
        <div
          key={t.id}
          className="fade-up"
          onClick={() => rm(t.id)}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: '#1a2338',
            border: `1px solid ${BORDER[t.type]}40`,
            borderLeft: `3px solid ${BORDER[t.type]}`,
            borderRadius: 9, padding: '11px 15px',
            minWidth: 250, maxWidth: 360,
            pointerEvents: 'all', cursor: 'pointer',
            boxShadow: `0 8px 24px rgba(0,0,0,0.4)`,
          }}
        >
          <span style={{ color: BORDER[t.type], fontSize: 14, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
            {ICON[t.type]}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.3 }}>{t.title}</div>
            {t.msg && <div style={{ fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>{t.msg}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
