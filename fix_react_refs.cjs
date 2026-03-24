const fs=require('fs'),path=require('path')

function walk(d){return fs.readdirSync(d).flatMap(f=>{const p=path.join(d,f);return fs.statSync(p).isDirectory()&&!['node_modules','dist','.git'].includes(f)?walk(p):[p]})}

// 修正所有文件里 shim 中的 React.useState / React.useEffect
let fixed=0
walk('src').filter(f=>f.endsWith('.jsx')||f.endsWith('.js')).forEach(file=>{
  let c=fs.readFileSync(file,'utf8')
  const orig=c

  // 1. 把 shim 块里的 React.useState/useEffect 改为独立函数调用
  c=c.replace(/React\.useState\(/g,'useState(')
  c=c.replace(/React\.useEffect\(/g,'useEffect(')

  // 2. 确保文件顶部有 useState/useEffect 的 import
  const needsHooks = c.includes('useState(') || c.includes('useEffect(')
  if(needsHooks){
    // 检查是否已经 import 了这些 hooks
    const hasUseState = c.includes("useState") && (c.includes("import {") || c.includes("import{"))
    // 找到第一个 import 行
    const firstImportMatch = c.match(/^import\s+.+from\s+['"]react['"]/m)
    if(firstImportMatch){
      // 已有 react import，确保包含 useState 和 useEffect
      const reactImport = firstImportMatch[0]
      if(!reactImport.includes('useState')||!reactImport.includes('useEffect')){
        let newImport = reactImport
        if(!newImport.includes('useState')) newImport=newImport.replace('{','{useState, ').replace('{ ','{ ')
        if(!newImport.includes('useEffect')) newImport=newImport.replace('{','{useEffect, ').replace('{ ','{ ')
        // 清理重复逗号
        newImport=newImport.replace(/\{\s*,\s*/g,'{').replace(/,\s*,/g,',')
        c=c.replace(reactImport, newImport)
      }
    } else if(!c.includes("from 'react'")&&!c.includes('from "react"')){
      // 没有 react import，加一个
      c="import { useState, useEffect } from 'react'\n"+c
    }
  }

  c=c.replace(/\n{3,}/g,'\n\n')
  if(c!==orig){
    fs.writeFileSync(file,c)
    console.log('fixed:',path.relative('.',file))
    fixed++
  }
})
console.log('Total:',fixed,'files fixed')
