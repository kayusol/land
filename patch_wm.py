# patch_worldmap.py — 替换 WorldMap 工作区为可交互版本
import re

with open('src/pages/WorldMap.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. 添加 useWalletClient, useState(extra) 等 import
old_import = "import { usePublicClient, useAccount } from 'wagmi'"
new_import = "import { usePublicClient, useAccount, useWalletClient } from 'wagmi'\nimport { encodeFunctionData, formatEther } from 'viem'\nimport { APO_EGG_GIF, drillImgUrl, ELEM_SVGS, ELEMS } from '../constants/images'"
c = c.replace(old_import, new_import)

# 2. 扩展 MINING_ABI — 加 startMining, stopMining, MAX_APOSTLES_PER_LAND, claim
old_mining = """const MINING_ABI = [
  { type:'function', name:'slotCount', inputs:[{name:'landId',type:'uint256'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'slots', inputs:[{name:'landId',type:'uint256'},{name:'index',type:'uint256'}],
    outputs:[{name:'apostleId',type:'uint256'},{name:'drillId',type:'uint256'},{name:'startTime',type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'pendingRewards', inputs:[{name:'landId',type:'uint256'}], outputs:[{type:'uint256[5]'}], stateMutability:'view' },
]"""
new_mining = """const MINING_ABI = [
  { type:'function', name:'slotCount', inputs:[{name:'landId',type:'uint256'}], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'slots', inputs:[{name:'landId',type:'uint256'},{name:'index',type:'uint256'}],
    outputs:[{name:'apostleId',type:'uint256'},{name:'drillId',type:'uint256'},{name:'startTime',type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'pendingRewards', inputs:[{name:'landId',type:'uint256'}], outputs:[{type:'uint256[5]'}], stateMutability:'view' },
  { type:'function', name:'MAX_APOSTLES_PER_LAND', inputs:[], outputs:[{type:'uint256'}], stateMutability:'view' },
  { type:'function', name:'startMining', inputs:[{name:'landId',type:'uint256'},{name:'apostleId',type:'uint256'},{name:'drillId',type:'uint256'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'stopMining', inputs:[{name:'landId',type:'uint256'},{name:'apostleId',type:'uint256'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'claim', inputs:[{name:'landId',type:'uint256'}], outputs:[], stateMutability:'nonpayable' },
  { type:'function', name:'apostleOnLand', inputs:[{name:'apostleId',type:'uint256'}], outputs:[{type:'uint256'}], stateMutability:'view' },
]
const APO_ABI_WM=[{type:'function',name:'attrs',inputs:[{name:'id',type:'uint256'}],outputs:[{name:'strength',type:'uint8'},{name:'element',type:'uint8'}],stateMutability:'view'},{type:'function',name:'nextId',inputs:[],outputs:[{type:'uint256'}],stateMutability:'view'},{type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view'},{type:'function',name:'setApprovalForAll',inputs:[{name:'op',type:'address'},{name:'v',type:'bool'}],outputs:[],stateMutability:'nonpayable'},{type:'function',name:'isApprovedForAll',inputs:[{name:'owner',type:'address'},{name:'op',type:'address'}],outputs:[{type:'bool'}],stateMutability:'view'}]
const DRL_ABI_WM=[{type:'function',name:'attrs',inputs:[{name:'id',type:'uint256'}],outputs:[{name:'tier',type:'uint8'},{name:'affinity',type:'uint8'}],stateMutability:'view'},{type:'function',name:'nextId',inputs:[],outputs:[{type:'uint256'}],stateMutability:'view'},{type:'function',name:'ownerOf',inputs:[{name:'id',type:'uint256'}],outputs:[{type:'address'}],stateMutability:'view'},{type:'function',name:'setApprovalForAll',inputs:[{name:'op',type:'address'},{name:'v',type:'bool'}],outputs:[],stateMutability:'nonpayable'}]
const NFT_ABI_WM=[{type:'function',name:'isApprovedForAll',inputs:[{name:'owner',type:'address'},{name:'op',type:'address'}],outputs:[{type:'bool'}],stateMutability:'view'}]"""
if old_mining in c:
    c = c.replace(old_mining, new_mining)
    print("MINING_ABI replaced OK")
else:
    print("MINING_ABI NOT FOUND")

with open('src/pages/WorldMap.jsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("Step1 done, len:", len(c))
