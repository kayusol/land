const fs=require('fs'),path=require('path')
function walk(d){return fs.readdirSync(d).flatMap(f=>{const p=path.join(d,f);return fs.statSync(p).isDirectory()&&!['node_modules','dist','.git'].includes(f)?walk(p):[p]})}
walk('src').filter(f=>f.endsWith('.jsx')||f.endsWith('.js')).forEach(f=>{
  const c=fs.readFileSync(f,'utf8')
  if(c.includes('wagmi')){
    const lines=c.split('\n').filter(l=>l.toLowerCase().includes('wagmi'))
    console.log('\n'+path.relative('.',f)+':')
    lines.forEach(l=>console.log(' ',l.trim().slice(0,100)))
  }
})
