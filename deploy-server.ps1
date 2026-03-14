# 部署到云服务器：先打包再上传，避免传 160+ 小文件时连接断开
# 使用：在项目根目录执行 .\deploy-server.ps1
# 会提示输入 root 密码两次（上传 zip、SSH 解压）

$ErrorActionPreference = "Stop"
$Server = "root@113.207.49.162"
$RemoteDir = "/var/www/evo-land"
$ZipName = "evo-land-dist.zip"

Write-Host "1/4 Building..." -ForegroundColor Cyan
npm run build
if (-not (Test-Path "dist\index.html")) { throw "Build failed: no dist/index.html" }

Write-Host "2/4 Zipping dist..." -ForegroundColor Cyan
if (Test-Path $ZipName) { Remove-Item $ZipName -Force }
$distPath = Resolve-Path "dist"
Compress-Archive -Path "$distPath\*" -DestinationPath $ZipName -Force

Write-Host "3/4 Uploading zip (enter password when prompted)..." -ForegroundColor Cyan
scp $ZipName "${Server}:${RemoteDir}/"

Write-Host "4/4 Unzipping on server (enter password when prompted)..." -ForegroundColor Cyan
ssh $Server "cd $RemoteDir && unzip -o $ZipName && rm -f $ZipName"

Remove-Item $ZipName -Force -ErrorAction SilentlyContinue
Write-Host "Done. Open http://113.207.49.162" -ForegroundColor Green
