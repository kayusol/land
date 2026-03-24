/**
 * mint-raw.cjs  — 纯 JSON-RPC，只依赖 Node.js 内置 fetch (v18+)
 * 运行: PRIVATE_KEY=0x... node mint-raw.cjs
 * 或者把私钥直接填到下面 PRIVATE_KEY 变量里
 */

// ── 私钥（部署者）────────────────────────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY || ''  // 填入 0x... 私钥

if (!PRIVATE_KEY || PRIVATE_KEY.length < 64) {
  console.error('❌ 请设置 PRIVATE_KEY 环境变量，或直接在脚本里填入私钥')
  console.error('   示例: PRIVATE_KEY=0xabc123... node mint-raw.cjs')
  process.exit(1)
}

const RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545'
const CHAIN_ID = 97

const ADDR = {
  ring:        '0x41550a11B94ee1c78898FEaae0617AAC3E155ec6',
  gold:        '0xbFaEb7b0BeD3684051F8d087717009eEd131C69f',
  wood:        '0x138C98Ca717917C584D878028bB02fB0BAc6E2c4',
  water:       '0x3618bCa0A8B4a56E1cC57b6B6F4e145104f4ea49',
  fire:        '0x3fb8134A6FFedc5bc467179905955fbE25780B33',
  soil:        '0xedAED55F28480839C5417D54160a1E0dDA7E9f13',
  land:        '0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073',
  drill:       '0xbA1C81247D9627b4F6EF4E40febB8D70E7bEd9Fe',
  apostle:     '0x3D06422b6623b422c4152cd53231f0F45232197A',
  mining:      '0x9eAcA7E8d08767BE5c00C92A7721FB4aC60ea3F2',
  auction:     '0x6dfAEDBD161f99d655a818AF23377344FB16db1a',
  initializer: '0x78707C585E3C28D6f861b9b3Ef14b0e665f52a7B',
  router:      '0xD99D1c33F9fC3444f8101754aBC46c52416550d1',
}

// ── 安装依赖 ethers v6（如果没有的话）───────────────────────
// 这个脚本需要 ethers v6 做签名，先检查再安装
async function ensureEthers() {
  try { return require('ethers') } catch {}
  console.log('📦 安装 ethers...')
  const { execSync } = require('child_process')
  execSync('npm install ethers@6 --no-save --quiet', { stdio:'inherit' })
  return require('ethers')
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function sendTx(wallet, to, data, valueWei = 0n) {
  const provider = wallet.provider
  for (let retry = 0; retry < 6; retry++) {
    try {
      const tx = await wallet.sendTransaction({ to, data, value: valueWei,
        gasLimit: 3_000_000n,
      })
      process.stdout.write(`  → ${tx.hash} `)
      await tx.wait()
      process.stdout.write('✓\n')
      await sleep(1500)
      return
    } catch(e) {
      const msg = (e.message||'').toLowerCase()
      if (msg.includes('rate') || msg.includes('429') || msg.includes('limit')) {
        const w = 3000 * (2**retry)
        console.log(`\n  ⚠ 限速，等 ${w}ms...`)
        await sleep(w); continue
      }
      throw e
    }
  }
}
