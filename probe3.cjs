const https = require('https')

function get(url) {
  return new Promise((res, rej) => {
    const req = https.get(url, {
      headers: {'User-Agent': 'Mozilla/5.0', 'Referer': 'https://portal.evolution.land/'}
    }, r => {
      const chunks = []
      r.on('data', c => chunks.push(c))
      r.on('end', () => res({status: r.statusCode, body: Buffer.concat(chunks).toString('utf8')}))
    })
    req.on('error', e => rej(e))
    req.setTimeout(15000, () => { req.destroy(); rej(new Error('timeout')) })
  })
}

async function main() {
  // 搜 main JS chunk 里的 gcs URL 和 apostle 图片引用
  console.log('Fetching main chunk...')
  const main = await get('https://portal.evolution.land/static/js/main.16e0116b.chunk.js')
  console.log('Size:', main.body.length, 'bytes')
  
  // 找所有 gcs.evolution.land URL
  const gcsUrls = [...new Set(main.body.match(/https?:\/\/gcs\.evolution\.land[^\s"'\\)]+/g) || [])]
  console.log('\n=== GCS URLs ===')
  gcsUrls.slice(0, 30).forEach(u => console.log(u))
  
  // 找 apostle_picture 相关字符串
  const picMatches = [...main.body.matchAll(/apostle.{0,50}(?:picture|image|img|png|gif|jpg)/gi)].map(m=>m[0])
  console.log('\n=== apostle picture refs ===')
  picMatches.slice(0,20).forEach(m=>console.log(m))
  
  // 找图片 URL 模式
  const imgUrls = [...new Set(main.body.match(/https?:\/\/[^\s"'\\)]+\.(png|gif|jpg|jpeg|webp)/g) || [])]
  console.log('\n=== Image URLs ===')
  imgUrls.slice(0,30).forEach(u=>console.log(u))
  
  // 找 backend.evolution.land 相关
  const backendUrls = [...new Set(main.body.match(/https?:\/\/backend\.[^\s"'\\)]+/g) || [])]
  console.log('\n=== Backend URLs ===')
  backendUrls.slice(0,20).forEach(u=>console.log(u))
}
main().catch(e=>console.log('ERR:', e.message))
