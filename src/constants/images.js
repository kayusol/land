// src/constants/images.js — 原版图片资源 URL
const GH = 'https://raw.githubusercontent.com/evolutionlandorg/evo-frontend/main/public/images'

// 使徒孵化器 GIF
export const APO_EGG_GIF = `${GH}/apostle/egg.gif`

// 钻头图片: class(0-2) x lv(1-5)
// class0=金/土, class1=木/火, class2=水
export function drillImgUrl(elem, tier) {
  // elem: 0=金,1=木,2=水,3=火,4=土 → class映射
  const classMap = [0, 1, 2, 1, 0]  // 金→0,木→1,水→2,火→1,土→0
  const cls = classMap[elem] ?? 0
  const lv  = Math.min(Math.max(Number(tier) || 1, 1), 5)
  return `${GH}/drill/class${cls}/lv${lv}.gif`
}

// 土地图片: 按 landId 选大陆原型 (1-5)
export function landImgUrl(landId) {
  const n = ((landId - 1) % 5) + 1
  return `${GH}/continents/prototype/${n}.png`
}

// 元素 SVG 图标
const GT = `${GH}/token`
export const ELEM_SVGS = [
  `${GT}/gold.svg`,
  `${GT}/wood.svg`,
  `${GT}/water.svg`,
  `${GT}/fire.svg`,
  `${GT}/soil.svg`,
]

// RING 图标
export const RING_SVG = `${GT}/ring.svg`

// 元素信息
export const ELEMS = [
  { key:'gold',  name:'金', symbol:'GOLD',  color:'#f0c040' },
  { key:'wood',  name:'木', symbol:'WOOD',  color:'#52c462' },
  { key:'water', name:'水', symbol:'HHO',   color:'#40a0f0' },
  { key:'fire',  name:'火', symbol:'FIRE',  color:'#f05030' },
  { key:'soil',  name:'土', symbol:'SIOO',  color:'#c08040' },
]
