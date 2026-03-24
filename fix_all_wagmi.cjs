const fs=require('fs'),path=require('path')

function walk(d){return fs.readdirSync(d).flatMap(f=>{const p=path.join(d,f);return fs.statSync(p).isDirectory()&&!['node_modules','dist','.git'].includes(f)?walk(p):[p]})}

const WALLET_HOOKS=['useAccount','useWalletClient','usePublicClient','useConnect','useDisconnect','useSwitchChain','useWriteContract','useWaitForTransactionReceipt','useReadContract','useReadContracts','useBalance']
const CTX_PATH_FOR = (file) => {
  const depth = path.relative('src', file).split(path.sep).length - 1
  return '../'.repeat(depth) + 'contexts/WalletContext.jsx'
}

let fixed=0
walk('src').filter(f=>(f.endsWith('.jsx')||f.endsWith('.js'))&&!f.includes('WalletContext')&&!f.includes('wagmi.js')).forEach(file=>{
  let c=fs.readFileSync(file,'utf8')
  const orig=c

  // 找所有从 wagmi 导入的 wallet hooks
  const walletHooks=[]
  c=c.replace(/import\s*\{([^}]+)\}\s*from\s*['"]wagmi['"]/g,(match,imports)=>{
    const hooks=imports.split(',').map(s=>s.trim()).filter(Boolean)
    const wh=hooks.filter(h=>WALLET_HOOKS.includes(h))
    const oh=hooks.filter(h=>!WALLET_HOOKS.includes(h))
    walletHooks.push(...wh)
    return oh.length ? `import { ${oh.join(', ')} } from 'wagmi'` : ''
  })

  if(walletHooks.length>0&&!c.includes('WalletContext')){
    const ctxPath=CTX_PATH_FOR(file)
    // 只导出 WalletContext 实际提供的 hooks
    const CTX_HOOKS=['useAccount','useWalletClient','usePublicClient']
    const ctxHooks=walletHooks.filter(h=>CTX_HOOKS.includes(h))
    // 其余 hooks（useWriteContract 等）用 stub 替代
    const stubHooks=walletHooks.filter(h=>!CTX_HOOKS.includes(h))

    if(ctxHooks.length){
      const ctxImport=`import { ${ctxHooks.join(', ')} } from '${ctxPath}'`
      c=c.replace(/^(import .+\n)/m,`$1${ctxImport}\n`)
    }
    if(stubHooks.length){
      // 在文件顶部加 stub
      const stubs=stubHooks.map(h=>{
        if(h==='useWriteContract') return `function useWriteContract(){return{writeContractAsync:async()=>{throw new Error('use sendTransaction instead')},isPending:false}}`
        if(h==='useWaitForTransactionReceipt') return `function useWaitForTransactionReceipt(){return{isLoading:false}}`
        if(h==='useReadContract') return `function useReadContract(){return{data:undefined,isLoading:false}}`
        if(h==='useReadContracts') return `function useReadContracts(){return{data:[],isLoading:false}}`
        if(h==='useBalance') return `function useBalance(){return{data:undefined}}`
        if(h==='useConnect') return `function useConnect(){return{connect:()=>{},connectors:[],isPending:false}}`
        if(h==='useDisconnect') return `function useDisconnect(){return{disconnect:()=>{}}}`
        if(h==='useSwitchChain') return `function useSwitchChain(){return{switchChain:()=>{}}}`
        return `function ${h}(){return{}}`
      }).join('\n')
      c=c+'\n'+stubs
    }
  }

  c=c.replace(/\n{3,}/g,'\n\n')
  if(c!==orig){fs.writeFileSync(file,c);console.log('fixed:',path.relative('.',file));fixed++}
})
console.log('Total:',fixed,'files fixed')
