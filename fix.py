
with open('src/pages/BlindBoxPage.jsx','r',encoding='utf-8') as f:
    c = f.read()

old = "setMsg('🎉 开启成功！')"
new = "setMsg('🎉 开启成功！'); setTimeout(()=>window.dispatchEvent(new CustomEvent('nav',{detail:{page:'assets',tab:'blindbox'}})), 2500)"

if old in c:
    c = c.replace(old, new)
    print("OK")
else:
    print("NOT FOUND")
    idx = c.find('开启成功')
    print(c[idx-20:idx+80] if idx>=0 else "none")

with open('src/pages/BlindBoxPage.jsx','w',encoding='utf-8') as f:
    f.write(c)
