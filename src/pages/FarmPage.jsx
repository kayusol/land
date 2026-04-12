import { useState } from 'react'
import { useAccount } from '../contexts/WalletContext.jsx'
import { useLang } from '../contexts/LangContext.jsx'
import { CONTRACTS } from '../constants/contracts'
import './FarmPage.css'

const POOLS = [
  { id:0, name:'RING-BNB LP',  apy:'120%' },
  { id:1, name:'RING-GOLD LP', apy:'80%'  },
  { id:2, name:'RING-WOOD LP', apy:'75%'  },
  { id:3, name:'RING-HHO LP',  apy:'70%'  },
  { id:4, name:'RING-FIRE LP', apy:'65%'  },
  { id:5, name:'RING-SIOO LP', apy:'60%'  },
]

function PoolRow({ pool }) {
  const [open,setOpen]=useState(false), [amount,setAmount]=useState('')
  const {t}=useLang()
  return(
    <div className={`pool-row ${open?'expanded':''}`}>
      <div className="pool-header" onClick={()=>setOpen(!open)}>
        <span className="pool-name">{pool.name}</span>
        <span className="pool-apy">APY {pool.apy}</span>
        <span className="pool-tvl">TVL {t('加载中','Loading')}</span>
        <span className="pool-arrow">{open?'▲':'▼'}</span>
      </div>
      {open&&(
        <div className="pool-body">
          <div className="pool-notice">
            ⚠️ {t(
              'LP矿池需先在 PancakeSwap 添加流动性获得LP Token，再质押此处。',
              'You need LP Tokens from PancakeSwap first, then stake here.'
            )}
            <br/>
            <a href={`https://pancake.kiemtienonline360.com/#/add/BNB/${CONTRACTS.ring}`}
              target="_blank" rel="noreferrer" className="pancake-link">
              {t('前往 PancakeSwap 添加流动性 ↗','Go to PancakeSwap to add liquidity ↗')}
            </a>
          </div>
          <div className="pool-inputs">
            <input type="number" placeholder={t('输入LP数量','Enter LP amount')}
              value={amount} onChange={e=>setAmount(e.target.value)} className="pool-input"/>
            <button className="pool-btn stake" disabled>{t('质押','Stake')} ({t('开发中','Dev')})</button>
            <button className="pool-btn unstake" disabled>{t('解除','Unstake')}</button>
            <button className="pool-btn claim" disabled>{t('领取','Claim')}</button>
          </div>
          <div className="pool-info-row">
            <span>RING {t('合约','Contract')}: </span>
            <a href={`https://testnet.bscscan.com/address/${CONTRACTS.ring}`} target="_blank" rel="noreferrer">
              {CONTRACTS.ring.slice(0,8)}…{CONTRACTS.ring.slice(-6)}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FarmPage() {
  const {t}=useLang()
  return(
    <div className="farm-page">
      <div className="farm-header">
        <h2>🌾 {t('流动性挖矿','Liquidity Mining')}</h2>
        <p>{t('质押LP Token获得RING奖励','Stake LP Tokens to earn RING rewards')}</p>
      </div>
      <div className="pool-list">
        {POOLS.map(p=><PoolRow key={p.id} pool={p}/>)}
      </div>
    </div>
  )
}
