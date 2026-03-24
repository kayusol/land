const fs=require('fs'),path=require('path')
function walk(d){return fs.readdirSync(d).flatMap(f=>{const p=path.join(d,f);return fs.statSync(p).isDirectory()&&!['node_modules','dist','.git'].includes(f)?walk(p):[p]})}

// 找所有调用 wc.sendTransaction 或 wc.writeContract 的文件
walk('src').filter(f=>f.endsWith('.jsx')||f.endsWith('.js')).forEach(f=>{
  const c=fs.readFileSync(f,'utf8')
  if(c.includes('wc.sendTransaction')||c.includes('wc.writeContract')){
    // 检查 wc 是怎么获取的
    const wcSource=c.match(/const\s+\{[^}]*data[:\s]*wc[^}]*\}.*useWalletClient/g)||
                   c.match(/const.*wc.*=.*useWalletClient/g)||[]
    console.log('\n'+path.relative('.',f))
    console.log('  wc source:', wcSource[0]?.trim().slice(0,80)||'unknown')
    // 统计 sendTransaction 调用数
    const calls=(c.match(/wc\.sendTransaction/g)||[]).length
    console.log('  sendTransaction calls:', calls)
  }
})
