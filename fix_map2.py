with open('src/pages/WorldMap.jsx','r',encoding='utf-8') as f:
    c=f.read()

# 完全重写 getPal，原版风格颜色系统
old_getpal = """// 按白皮书规则 + 元素属性混色，返回5色调色板
function getPal(id,owners,attrs,aucs,slots,address) {
  const own=owners[id]; if(!own) return null
  const isMe=address&&own.toLowerCase()===address.toLowerCase()
  if(isMe&&aucs[id]) return PAL.MY_AUC
  if(isMe) {
    const e=domElem(id,attrs)
    if(e>=0) {
      const ep=EPALS[e]
      return [PAL.MY[0],ep[0],PAL.MY[2],ep[1],PAL.MY[4]]
    }
    return PAL.MY
  }
  if(aucs[id]) return PAL.ONSALE
  if(slots[id]?.length>0) {
    const e=domElem(id,attrs)
    return e>=0?EPALS[e]:PAL.MINE
  }
  // 有主：用元素色调混红
  const e=domElem(id,attrs)
  if(e>=0) {
    const ep=EPALS[e]
    return [PAL.OWNED[0],ep[0],PAL.OWNED[2],ep[1],PAL.OWNED[4]]
  }
  return PAL.OWNED
}"""

new_getpal = """// 原版颜色系统: 元素色决定色相，状态决定亮度
function getPal(id,owners,attrs,aucs,slots,address) {
  const own=owners[id]; if(!own) return null
  const isMe=address&&own.toLowerCase()===address.toLowerCase()
  const e=domElem(id,attrs)  // 主元素 0-4
  // 我的地块挂拍 → 红色高亮（最高优先级）
  if(isMe&&aucs[id]) return PAL.MY_AUC
  // 我的地块挖矿中 → 橙色叠元素
  if(isMe&&slots[id]?.length>0) {
    return e>=0?[PAL.MY[0],EPALS[e][0],PAL.MY[2],EPALS[e][1],PAL.MY[4]]:PAL.MY
  }
  // 我的地块 → 纯橙
  if(isMe) return e>=0?[PAL.MY[0],EPALS[e][0],PAL.MY[2],EPALS[e][1],PAL.MY[4]]:PAL.MY
  // 拍卖中 → 亮绿（荷兰拍卖标识，原版颜色）
  if(aucs[id]) return e>=0?[PAL.ONSALE[0],EPALS[e][0],PAL.ONSALE[2],EPALS[e][1],PAL.ONSALE[4]]:PAL.ONSALE
  // 挖矿中 → 纯元素色（最漂亮，原版如此）
  if(slots[id]?.length>0) return e>=0?EPALS[e]:PAL.MINE
  // 有主未挖 → 元素色（稍暗，用EPALS降亮度版）
  if(e>=0) return EPALS[e]
  return PAL.OWNED
}"""

if old_getpal in c:
    c=c.replace(old_getpal, new_getpal)
    print('OK: getPal rewritten')
else:
    print('MISS getPal')
    idx=c.find('function getPal')
    print(repr(c[idx:idx+100]))

with open('src/pages/WorldMap.jsx','w',encoding='utf-8') as f:
    f.write(c)
print('Lines:', c.count('\n'))
