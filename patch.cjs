const fs = require('fs')
const path = 'src/pages/WorldMap.jsx'
let c = fs.readFileSync(path, 'utf8')

// 1. 替换 CLR 颜色定义（完全按白皮书）
const oldCLR = `// 完全复刻原版 Evolution Land 颜色
const CLR = {
  MY:      '#ff9990',
  MY_AUC:  '#ff4053',
  GENESIS: '#9ac95e',
  RESERVE: '#46f9da',
  UNOWNED_ODD:  '#110e13',
  UNOWNED_EVEN: '#0d0b0e',
  OWNED:   '#ef4d5c',
  MINE:    '#fe8846',
  ONSALE:  '#319866',
  MYSTIC:  '#b269d3',
  SEL_STROKE: '#ff0044',
  HOV: 'rgba(255,255,255,0.15)',
}`

const newCLR = `// 白皮书颜色规则（完全复刻原版）
// 首次售卖(绿) 保留地(青) 无主(蓝紫) 有主(红) 我的(橙) 拍卖中(深绿) 神秘(紫)
const CLR = {
  MY:      { base:'#ff9900', hi:'#ffb84d', lo:'#cc7700' },  // 我的（橙色）
  MY_AUC:  { base:'#ff4053', hi:'#ff6070', lo:'#cc2030' },  // 我的拍卖（亮红）
  GENESIS: { base:'#52b840', hi:'#76d460', lo:'#2a8020' },  // 首次售卖（绿）
  RESERVE: { base:'#20c4a0', hi:'#48e0c0', lo:'#0a9070' },  // 保留地（青）
  UNOWNED: { base:'#4a52a8', hi:'#6060c0', lo:'#2a3070' },  // 无主（蓝紫）
  OWNED:   { base:'#d04050', hi:'#e85060', lo:'#901020' },  // 有主（红）
  MINE:    { base:'#e07020', hi:'#f09040', lo:'#a04010' },  // 挖矿中（深橙）
  ONSALE:  { base:'#208858', hi:'#30b070', lo:'#106030' },  // 拍卖中（深绿）
  MYSTIC:  { base:'#8040c0', hi:'#a060e0', lo:'#502080' },  // 神秘矿藏（紫）
  SEL_STROKE: '#ff0044',
  HOV: 'rgba(255,255,255,0.15)',
}

// 伪随机数生成器（按坐标确定，保证颜色稳定）
function seededRand(seed) {
  let s = seed ^ 0xdeadbeef
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
  s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
  return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff
}

// 解析 hex 颜色为 RGB
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n>>16)&255, (n>>8)&255, n&255]
}

// 混合两个 RGB
function mixRgb(a, b, t) {
  return [a[0]+((b[0]-a[0])*t)|0, a[1]+((b[1]-a[1])*t)|0, a[2]+((b[2]-a[2])*t)|0]
}

function rgbStr(r) { return \`rgb(\${r[0]},\${r[1]},\${r[2]})\` }`

if (c.includes(oldCLR)) {
  c = c.replace(oldCLR, newCLR)
  console.log('CLR replaced')
} else {
  console.log('CLR NOT FOUND, searching...')
  console.log(c.indexOf('// 完全复刻原版 Evolution Land 颜色'))
}
fs.writeFileSync(path, c)
