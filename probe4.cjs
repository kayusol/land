const https = require('https')
const fs = require('fs')

function get(url) {
  return new Promise((res, rej) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
        'Referer': 'https://portal.evolution.land/',
      }
    }, r => {
      const chunks = []
      r.on('data', c => chunks.push(c))
      r.on('end', () => res({status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks).toString('latin1')}))
    })
    req.on('error', e => rej(e))
    req.setTimeout(15000, () => { req.destroy(); rej(new Error('timeout')) })
  })
}

async function main() {
  // 搜两个 chunk 文件里的所有 portal.evolution.land 图片路径
  const chunks = [
    'https://portal.evolution.land/static/js/main.16e0116b.chunk.js',
    'https://portal.evolution.land/static/js/178.f3316f63.chunk.js',
  ]
  
  const allPaths = new Set()
  
  for (const url of chunks) {
    console.log('Fetching', url.split('/').pop(), '...')
    const r = await get(url)
    const body = Buffer.from(r.body, 'latin1').toString('utf8')
    
    // 找所有相对路径的图片
    const matches = [
      ...body.matchAll(/["']([a-zA-Z0-9/_-]+\.(png|gif|jpg|webp|svg))["']/g)
    ].map(m => m[1])
    
    // 找所有包含 apostle 或 drill 的
    const apoMatches = matches.filter(p => p.includes('apostle') || p.includes('drill') || p.includes('nft') || p.includes('mining'))
    apoMatches.forEach(p => allPaths.add(p))
    
    // 找 apostle_picture 前后的内容
    const picIdx = body.indexOf('apostle_picture')
    if (picIdx > 0) {
      console.log('\napostle_picture context:')
      console.log(body.slice(Math.max(0, picIdx-100), picIdx+300))
    }
    
    console.log('\nAll apostle/drill paths:')
    apoMatches.forEach(p => console.log(' ', p))
  }
  
  // 测试这些路径是否可访问
  console.log('\n\n=== Testing portal.evolution.land paths ===')
  const toTest = [...allPaths].slice(0, 20)
  for (const path of toTest) {
    const url = 'https://portal.evolution.land/' + path
    try {
      const r = await get(url)
      const ct = r.headers['content-type'] || ''
      if (r.status === 200 && (ct.includes('image') || ct.includes('png'))) {
        console.log('✅ HIT:', url)
      } else {
        console.log('['+r.status+']', path)
      }
    } catch(e) {
      console.log('ERR', path, e.message)
    }
  }
}
main().catch(e => console.log('Fatal:', e.message))
