const fs = require('fs'), path = require('path')
function walk(dir){
  const res=[]
  for(const f of fs.readdirSync(dir)){
    const p=path.join(dir,f)
    if(fs.statSync(p).isDirectory()) res.push(...walk(p))
    else if(f.endsWith('.js')||f.endsWith('.jsx')) res.push(p)
  }
  return res
}
const imports=new Set()
for(const file of walk('src')){
  const c=fs.readFileSync(file,'utf8')
  const lines=c.split('\n')
  for(const line of lines){
    if(!line.includes('constants/contracts')) continue
    const m=line.match(/import\s*\{([^}]+)\}/)
    if(m) m[1].split(',').map(s=>s.trim().replace(/\s+as\s+\w+/,'')).filter(Boolean).forEach(s=>imports.add(s))
  }
}
console.log([...imports].sort().join('\n'))
