const fs = require('fs'), path = require('path')

function walk(d) {
  return fs.readdirSync(d).flatMap(f => {
    const p = path.join(d, f)
    return fs.statSync(p).isDirectory() && !['node_modules','dist','.git'].includes(f) ? walk(p) : [p]
  })
}

const WALLET_HOOKS = ['useAccount','useWalletClient','usePublicClient','useConnect','useDisconnect','useSwitchChain']
const files = walk('src').filter(f => (f.endsWith('.jsx')||f.endsWith('.js')) && !f.includes('WalletContext') && !f.includes('wagmi.js') && !f.includes('wagmiConfig'))

let changed = 0
files.forEach(file => {
  let c = fs.readFileSync(file, 'utf8')
  const orig = c

  // 收集从 wagmi 导入的 wallet hooks
  const walletHooks = []
  c = c.replace(/import\s*\{([^}]+)\}\s*from\s*['"]wagmi['"]/g, (match, imports) => {
    const hooks = imports.split(',').map(s => s.trim()).filter(Boolean)
    const wh = hooks.filter(h => WALLET_HOOKS.includes(h))
    const oh = hooks.filter(h => !WALLET_HOOKS.includes(h))
    walletHooks.push(...wh)
    if (oh.length) return `import { ${oh.join(', ')} } from 'wagmi'`
    return ''
  })

  // 计算相对路径深度
  const relParts = path.relative('src', file).split(path.sep)
  const depth = relParts.length - 1
  const prefix = '../'.repeat(depth) || './'

  // 加入 WalletContext import
  if (walletHooks.length > 0 && !c.includes('WalletContext')) {
    const ctxPath = prefix + 'contexts/WalletContext.jsx'
    const ctxImport = `import { ${walletHooks.join(', ')} } from '${ctxPath}'`
    // 插入到第一行 import 之后
    c = c.replace(/^(import .+\n)/m, `$1${ctxImport}\n`)
  }

  // 清理多余空行
  c = c.replace(/\n{3,}/g, '\n\n')

  if (c !== orig) {
    fs.writeFileSync(file, c)
    console.log('Updated:', file)
    changed++
  }
})
console.log(`\nTotal: ${changed} files updated`)
