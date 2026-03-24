
with open('src/pages/WorldMap.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 修复中文括号导致的语法错误
c = c.replace(
    "setPickerMsg(myItems.length>0?`找到 ${myItems.length} 个`:'钱包中无可用'+（type==='apostle'?'使徒':'钻头'))",
    "setPickerMsg(myItems.length>0?`找到 ${myItems.length} 个`:`钱包中无可用${type==='apostle'?'使徒':'钻头'}`)"
)

# 修复 startMining 传 0n 的问题 — 合约需要真实的使徒+钻头配对
# 如果没有配对，picker应该要求同时选使徒和钻头
# 简化：startMining 只能同时放一个使徒+一个钻头（让用户选使徒时同时选钻头）
# 暂时改成：只传实际ID，另一个传0（看合约是否支持）
# 保持原逻辑不变，只修这个语法错误

with open('src/pages/WorldMap.jsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("fixed, len:", len(c))

# 验证没有语法问题的关键行
idx = c.find("setPickerMsg(myItems.length")
print("check:", c[idx:idx+100])
