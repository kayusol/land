const https = require('https')
const fs = require('fs')

// 原版网站的 bundle 里找真实的 apostle_picture URL 格式
// 先拿 portal.evolution.land 的 index.html 看 script src
function get(url) {
  return new Promise((res, rej) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        'Accept': '*/*',
        'Referer': 'https://portal.evolution.land/',
      }
    }, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => res({status: r.statusCode, headers: r.headers, body: d}))
    })
    req.on('error', e => rej(e))
    req.setTimeout(10000, () => { req.destroy(); rej(new Error('timeout')) })
  })
}

async function main() {
  try {
    // 1. 拿主页HTML，找script标签
    const index = await get('https://portal.evolution.land/')
    console.log('Index status:', index.status)
    
    // 找所有 .js chunk 文件
    const jsFiles = [...index.body.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1])
    console.log('JS files found:', jsFiles.length, jsFiles.slice(0,5).join('\n'))
    
    if (jsFiles.length === 0) {
      // 尝试找 asset manifest
      const manifest = await get('https://portal.evolution.land/asset-manifest.json')
      console.log('Manifest status:', manifest.status, manifest.body.slice(0,500))
    }
  } catch(e) {
    console.log('Error:', e.message)
  }
  
  // 2. 直接试几个已知的 gcs URL 格式（从图片截图里分析）
  // 从之前截图可以看到使徒有像 spine 动画风格，图片应该是 PNG
  const gcsTests = [
    'https://gcs.evolution.land/apostle/png/0x2a040001040001020000000000000000040000000000000000000000000000356d.png',
    'https://gcs.evolution.land/apostle/0x2a040001040001020000000000000000040000000000000000000000000000356d/image.png',
    'https://gcs.evolution.land/nft-images/apostle/13677.png',
    'https://gcs.evolution.land/apostle-images/13677.png',
    'https://gcs.evolution.land/apostle/preview/13677.png',
    'https://gcs.evolution.land/evolutionland/apostle/13677.png',
    'https://storage.googleapis.com/evolution-land/apostle/13677.png',
    'https://storage.googleapis.com/gcs.evolution.land/apostle/13677.png',
  ]
  
  for (const url of gcsTests) {
    try {
      const r = await get(url)
      const ct = r.headers['content-type'] || ''
      const size = r.body.length
      if (r.status === 200 && ct.includes('image')) {
        console.log('🎯 HIT!', url, ct, size, 'bytes')
      } else {
        console.log('['+r.status+']', url.replace('https://','').slice(0,70), ct.slice(0,30))
      }
    } catch(e) {
      console.log('ERR', url.slice(-40), e.message)
    }
  }
}
main()
