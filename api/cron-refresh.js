// api/cron-refresh.js — 每5分钟预热缓存（Vercel Cron Job）
export default async function handler(req, res) {
  // 验证 cron secret 防止外部调用
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET || 'evo-cron'}`) {
    res.status(401).json({ error: 'Unauthorized' }); return
  }
  try {
    // 调用 listings 接口刷新缓存
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    const r = await fetch(`${base}/api/listings`)
    const d = await r.json()
    res.status(200).json({ ok: true, counts: { apostles: d.apostleIds?.length, drills: d.drillIds?.length, lands: (d.landIds?.length||0)+(d.oldLandIds?.length||0) } })
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message })
  }
}
