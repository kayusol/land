import re

with open('src/pages/WorldMap.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 去掉平滑算法，保留纯 crypto random
old_smooth = """  // 做一次空间平滑：每格和相邻格取众数，避免孤立噪点
  const b = new Uint8Array(a)
  for (let col = 1; col < COLS-1; col++) {
    for (let row = 1; row < ROWS-1; row++) {
      const votes = [0,0,0,0,0,0,0,0]
      votes[a[col*ROWS+row]]+=2       // 自身权重2
      votes[a[(col-1)*ROWS+row]]++
      votes[a[(col+1)*ROWS+row]]++
      votes[a[col*ROWS+row-1]]++
      votes[a[col*ROWS+row+1]]++
      b[col*ROWS+row]=votes.indexOf(Math.max(...votes))
    }
  }
  return b"""

new_smooth = "  return a"

if old_smooth in c:
    c = c.replace(old_smooth, new_smooth)
    print("smooth removed OK")
else:
    print("smooth NOT FOUND")

with open('src/pages/WorldMap.jsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("Done, len:", len(c))
