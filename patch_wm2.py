# patch_wm2.py — 替换工作区JSX + 添加挤出弹窗
import re

with open('src/pages/WorldMap.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 替换工作区 section（使徒 + 钻头）
old_workspace = """            <div className="wm-sec">
              <div className="wm-sec-title">使徒工作区 (APOSTLE WORKSPACE)</div>
              <div className="wm-slots">
                {[0,1,2,3,4].map(i=>{const s=selSlots[i];return(
                  <div key={i} className={`wm-slot${s?' used':''}`}>
                    {s?(<><div>🧙</div><div className="wm-slot-lbl">#{s.apostleId.toString()}</div></>):<div className="wm-slot-add">＋</div>}
                  </div>
                )})}
              </div>
            </div>
            <div className="wm-sec">
              <div className="wm-sec-title">钻头工作区 (DRILLS WORKSPACE)</div>
              <div className="wm-slots">
                {[0,1,2,3,4].map(i=>{const s=selSlots[i];return(
                  <div key={i} className={`wm-slot${s?' used':''}`}>
                    {s?(<><div>⛏️</div><div className="wm-slot-lbl">#{s.drillId.toString()}</div></>):<div className="wm-slot-add">＋</div>}
                  </div>
                )})}
              </div>
            </div>"""

new_workspace = """            <div className="wm-sec">
              <div className="wm-sec-title">
                使徒工作区 (APOSTLE WORKSPACE)
                {selOwner&&<button className="wm-btn-sm" onClick={()=>openPicker('apostle')}>＋ 放置</button>}
              </div>
              <div className="wm-slots">
                {[0,1,2,3,4].map(i=>{const s=selSlots[i];return(
                  <div key={i} className={`wm-slot${s?' used':''}`} onClick={()=>s?null:openPicker('apostle')}>
                    {s?(
                      <div className="wm-slot-inner">
                        <img src={APO_EGG_GIF} style={{width:32,height:32}}/>
                        <div className="wm-slot-lbl">#{s.apostleId.toString()}</div>
                        {isMe&&<button className="wm-slot-stop" onClick={e=>{e.stopPropagation();handleStopMining(sel,s.apostleId)}}>×</button>}
                      </div>
                    ):<div className="wm-slot-add">＋</div>}
                  </div>
                )})}
              </div>
            </div>
            <div className="wm-sec">
              <div className="wm-sec-title">
                钻头工作区 (DRILLS WORKSPACE)
                {selOwner&&<button className="wm-btn-sm" onClick={()=>openPicker('drill')}>＋ 放置</button>}
              </div>
              <div className="wm-slots">
                {[0,1,2,3,4].map(i=>{const s=selSlots[i];return(
                  <div key={i} className={`wm-slot${s?' used':''}`} onClick={()=>s?null:openPicker('drill')}>
                    {s?(
                      <div className="wm-slot-inner">
                        <img src={drillImgUrl(0,s.drillTier||1)} style={{width:32,height:32}}/>
                        <div className="wm-slot-lbl">#{s.drillId.toString()}</div>
                      </div>
                    ):<div className="wm-slot-add">＋</div>}
                  </div>
                )})}
              </div>
            </div>
            {selOwner&&isMe&&(
              <div className="wm-sec">
                <button className="wm-btn-claim" onClick={()=>handleClaim(sel)}>💰 领取资源</button>
              </div>
            )}
            {/* 放置选择器弹窗 */}
            {picker&&(
              <div className="wm-picker-overlay" onClick={()=>setPicker(null)}>
                <div className="wm-picker" onClick={e=>e.stopPropagation()}>
                  <div className="wm-picker-head">
                    {picker==='apostle'?'选择使徒':'选择钻头'}
                    <button onClick={()=>setPicker(null)}>✕</button>
                  </div>
                  {pickerMsg&&<div className="wm-picker-msg">{pickerMsg}</div>}
                  {pickerItems.length===0
                    ?<div style={{padding:'1rem',color:'#5040a0',textAlign:'center'}}>钱包中无可用{picker==='apostle'?'使徒':'钻头'}</div>
                    :<div className="wm-picker-grid">
                      {pickerItems.map(item=>(
                        <div key={item.id} className="wm-picker-item" onClick={()=>handlePlace(item)}>
                          <img src={picker==='apostle'?APO_EGG_GIF:drillImgUrl(item.elem||0,item.tier||1)} style={{width:40,height:40}}/>
                          <div style={{fontSize:'.7rem',color:'#c090ff'}}>#{item.id}</div>
                          <div style={{fontSize:'.65rem',color:ELEMS[item.elem||0].color}}>
                            {ELEMS[item.elem||0].name}{picker==='apostle'?` 力量${item.strength}`:`${'★'.repeat(item.tier||1)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  }
                </div>
              </div>
            )}"""

if old_workspace in c:
    c = c.replace(old_workspace, new_workspace)
    print("workspace replaced OK")
else:
    print("workspace NOT FOUND - checking")
    idx = c.find('使徒工作区')
    print(f"at: {idx}")

with open('src/pages/WorldMap.jsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("done, len:", len(c))
