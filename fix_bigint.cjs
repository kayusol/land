const fs=require('fs'),path=require('path')
function walk(d){return fs.readdirSync(d).flatMap(f=>{const p=path.join(d,f);return fs.statSync(p).isDirectory()&&!['node_modules','dist','.git'].includes(f)?walk(p):[p]})}

let fixed=0
walk('src').filter(f=>f.endsWith('.jsx')||f.endsWith('.js')).forEach(file=>{
  let c=fs.readFileSync(file,'utf8')
  const orig=c
  // JSON.stringify(contracts) → String(contracts?.length)
  c=c.replace(/JSON\.stringify\(contracts\)/g,'contracts?.length')
  // JSON.stringify(args) → String(args?.map?.(a=>typeof a==='bigint'?a.toString():a))
  c=c.replace(/JSON\.stringify\(args\)/g,'args?.map?.(a=>typeof a==="bigint"?a.toString():String(a)).join(",")')
  if(c!==orig){fs.writeFileSync(file,c);console.log('fixed:',path.relative('.',file));fixed++}
})
console.log('Total:',fixed,'files fixed')
