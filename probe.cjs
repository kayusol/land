const https = require('https')

// 直接调用 evolution.land 的 API，加上 referer 和完整 headers
function tryApi(url, headers={}) {
  return new Promise(resolve => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
        'Referer': 'https://portal.evolution.land/',
        'Origin': 'https://portal.evolution.land',
        'Accept': 'application/json',
        ...headers
      }
    }, r => {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => resolve({status: r.statusCode, data: d.slice(0,600)}))
    }).on('error', e => resolve({status: 0, data: e.message}))
    req.setTimeout(8000, () => { req.destroy(); resolve({status: -1, data: 'timeout'}) })
  })
}

async function main() {
  // 试各种 API endpoint 格式
  const tests = [
    ['https://backend.evolution.land/api/apostle/index?network=Heco&limit=1', {}],
    ['https://backend.evolution.land/apostle/index?network=Heco&limit=1', {}],
    ['https://backend.evolution.land/api/apostle/index', {'EVO-NETWORK':'Heco'}],
    ['https://backend.evolution.land/napi/apostle/index?network=Heco&limit=1', {}],
    ['https://backend.evolution.land/api/v1/apostle/index?network=Heco&limit=1', {}],
    // 试 apostle 图片直接规律
    ['https://gcs.evolution.land/apostle/0x2a040001040001020000000000000000040000000000000000000000000000356d.png', {}],
    ['https://gcs.evolution.land/nft/0x2a04000104000102000000000000000004.png', {}],
  ]

  for (const [url, hdrs] of tests) {
    const r = await tryApi(url, hdrs)
    const short = url.replace('https://','').slice(0,60)
    console.log(`[${r.status}] ${short}`)
    if (r.status === 200) {
      console.log('  DATA:', r.data.slice(0,200))
    }
  }
}
main()
