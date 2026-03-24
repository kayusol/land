with open('src/pages/WorldMap.jsx','r',encoding='utf-8') as f:
    c=f.read()

# Fix 1: 未铸造格子用 Perlin 元素色
old1 = """          if(!own){
            // 未铸造：稍亮的深色，能看出格子
            ctx.fillStyle='#201c30'; ctx.fillRect(px,py,csz,csz)
          } else if(!inF){"""

new1 = """          if(!own){
            // 未铸造：Perlin噪声元素色（原版风格，彩色地形）
            const et=_UNOWNED_MAP[col*ROWS+row]
            const up=EPALS_UNOWNED[et]
            ctx.fillStyle=up[0]; ctx.fillRect(px,py,csz,csz)
            if(sz>=4){
              const rnd2=sr((col*97+row*131)*17)
              if(rnd2<0.2){ctx.fillStyle=up[1];ctx.fillRect(px,py,csz>>1,csz>>1)}
              else if(rnd2<0.38){ctx.fillStyle=up[2];ctx.fillRect(px+(csz>>1),py+(csz>>1),csz>>1,csz>>1)}
            }
          } else if(!inF){"""

# Fix 2: initZoom - 初始缩放让地图填满屏幕（窗口高度自适应）
old2 = "  const initZoom = Math.max(0.6, (window.innerHeight-80)/(ROWS*CELL))"
new2 = "  const initZoom = Math.max(0.5, Math.min((window.innerHeight-80)/(ROWS*CELL), (window.innerWidth)/(COLS*CELL)))"

# Fix 3: 地图 focused land 自动居中 - 使用 ref 的 setPan
old3 = "  const zR=()=>{ focusedR.current=false; const h=window.innerHeight-80; setZoom(Math.max(0.6,h/(ROWS*CELL))); setPan({x:0,y:0}) }"
new3 = "  const zR=()=>{ focusedR.current=false; const z=Math.max(0.5,Math.min((window.innerHeight-80)/(ROWS*CELL),(window.innerWidth)/(COLS*CELL))); zoomRef.current=z; _setZoom(z); panRef.current={x:0,y:0}; dirtyRef.current=true }"

fixes = [(old1,new1,'unowned elem color'), (old2,new2,'initZoom'), (old3,new3,'zR reset')]
for old,new,name in fixes:
    if old in c:
        c=c.replace(old,new)
        print(f'OK: {name}')
    else:
        print(f'MISS: {name}')
        # find closest
        for line in old.split('\n')[:2]:
            idx=c.find(line.strip())
            if idx>=0:
                print(f'  found fragment at {idx}: {repr(c[idx:idx+80])}')
                break

with open('src/pages/WorldMap.jsx','w',encoding='utf-8') as f:
    f.write(c)
print('Done, lines:', c.count('\n'))
