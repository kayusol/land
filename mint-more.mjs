/**
 * mint-more.mjs — 补铸地块成矩形区域，让地图好看
 * 铸造 x=0-9, y=0-4 共 50 块（10列×5行）
 */
import { ethers } from 'ethers'

const PK  = '0x7f9b1b073f152dc2323951c1646dc39de761ac10bd14b3eda9d37bbc6a8813cf'
const RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545'

const provider = new ethers.JsonRpcProvider(RPC)
const wallet   = new ethers.Wallet(PK, provider)

const INIT_ABI = ['function batchMint(int16[] xs,int16[] ys,uint80[] attrs,address to) external']
const LAND_ABI = ['function ownerOf(uint256) view returns(address)']
const INIT_ADDR = '0x78707C585E3C28D6f861b9b3Ef14b0e665f52a7B'
const LAND_ADDR = '0x6cE20f0306036F6f17e0D69B5Cd6b5d5D0EBf073'

const init = new ethers.Contract(INIT_ADDR, INIT_ABI, wallet)
const land = new ethers.Contract(LAND_ADDR, LAND_ABI, provider)

function encodeAttr(g,w,wa,f,s) {
  return BigInt(g)|(BigInt(w)<<16n)|(BigInt(wa)<<32n)|(BigInt(f)<<48n)|(BigInt(s)<<64n)
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

console.log('🔑 钱包:', wallet.address)
const bal = await provider.getBalance(wallet.address)
console.log('💰 余额:', ethers.formatEther(bal), 'tBNB\n')

// 目标：x=0-9, y=0-4，共 50 块（已有的跳过）
const TARGET = []
for (let x = 0; x <= 9; x++) {
  for (let y = 0; y <= 4; y++) {
    const id = x * 100 + y + 1
    try {
      const owner = await land.ownerOf(id)
      if (owner !== '0x0000000000000000000000000000000000000000') {
        console.log(`  跳过 (${x},${y}) 已存在`)
        continue
      }
    } catch(e) {}
    TARGET.push({ x, y })
  }
}
console.log(`\n需要铸造 ${TARGET.length} 块地\n`)
if (TARGET.length === 0) { console.log('全部已铸造！'); process.exit(0) }

// 分批铸造，每批 10 块
const BATCH_SIZE = 10
for (let b = 0; b < TARGET.length; b += BATCH_SIZE) {
  const batch = TARGET.slice(b, b + BATCH_SIZE)
  const xs = [], ys = [], attrs = []
  for (const {x, y} of batch) {
    xs.push(x); ys.push(y)
    const s = x * 137 + y * 97
    attrs.push(encodeAttr(
      (s*3+10)%100+5, (s*7+20)%100+5,
      (s*11+30)%100+5, (s*13+40)%100+5, (s*17+50)%100+5
    ))
  }
  for (let retry = 0; retry < 5; retry++) {
    try {
      const tx = await init.batchMint(xs, ys, attrs, wallet.address)
      process.stdout.write(`  批次 ${Math.floor(b/BATCH_SIZE)+1}: ${tx.hash.slice(0,14)}...`)
      await tx.wait()
      process.stdout.write(' ✓\n')
      console.log('  坐标:', batch.map(p=>`(${p.x},${p.y})`).join(' '))
      await sleep(1500)
      break
    } catch(e) {
      const m = (e.message||'').toLowerCase()
      if ((m.includes('rate')||m.includes('429')) && retry < 4) {
        const w = 3000*(2**retry); console.log(`\n  ⚠ 限速 等${w}ms`); await sleep(w); continue
      }
      console.log('  ⚠ 失败:', e.reason||e.shortMessage||e.message)
      break
    }
  }
}

console.log('\n🎉 完成！刷新地图查看矩形地块区域。')
