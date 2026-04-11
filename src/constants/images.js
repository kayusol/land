// src/constants/images.js — 图片资源 URL
const GH = 'https://raw.githubusercontent.com/evolutionlandorg/evo-frontend/main/public/images'

// 使徒孵化器 GIF（蛋）
export const APO_EGG_GIF = `${GH}/apostle/egg.gif`

// 使徒成体 GIF — 成年后显示此图，加 hue-rotate 区分元素
export const APO_ADULT_GIF = `${GH}/apostle/apostle.gif`

// 钻头图片: class(0-2) x lv(1-5)
export function drillImgUrl(elem, tier) {
  const classMap = [0, 1, 2, 1, 0]
  const cls = classMap[elem] ?? 0
  const lv  = Math.min(Math.max(Number(tier) || 1, 1), 5)
  return `${GH}/drill/class${cls}/lv${lv}.gif`
}

// 土地图片
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

export const RING_SVG = `${GT}/ring.svg`

export const ELEMS = [
  { key:'gold',  name:'金', nameEn:'Gold',  symbol:'GOLD',  color:'#f0c040' },
  { key:'wood',  name:'木', nameEn:'Wood',  symbol:'WOOD',  color:'#52c462' },
  { key:'water', name:'水', nameEn:'Water', symbol:'HHO',   color:'#40a0f0' },
  { key:'fire',  name:'火', nameEn:'Fire',  symbol:'FIRE',  color:'#f05030' },
  { key:'soil',  name:'土', nameEn:'Soil',  symbol:'SIOO',  color:'#c08040' },
]
