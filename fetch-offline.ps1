# 離線包：把網站用到的縮圖與說明（Wikipedia、Wikidata、Wikimedia Commons）抓到本機，
# 縮小並轉成 WebP 存進 public\offline，之後網站瀏覽時完全不再連線到維基。
#
# 用法（在專案資料夾內）：
#   powershell -ExecutionPolicy Bypass -File .\fetch-offline.ps1
#   選項：-DelayMs 500    每次請求間隔毫秒（預設 250；一次只送一個請求，數字越大對維基越友善）
#         -Refresh        全部重抓（預設只補缺少的）
#         -DryRun         只列出需要抓的數量，不連線
#         -SheetsOnly     不連線，只把已下載的縮圖依年代合併成大圖（下載進行中也可在另一個視窗執行）
# 中斷（Ctrl+C、斷線、關機）後再執行一次即可從中斷處接著抓；已抓過的不會再請求。
# 每次抓完會自動把縮圖依年代合併成大圖（public\offline\sheets），網站只下載瀏覽到的年代。
# 完成後 commit public\offline 即可（img 資料夾是本機快取，已列入 .gitignore，不需上傳）；圖片的作者與授權清單在 public\offline\CREDITS.md。
param(
  [int]$DelayMs = 250,
  [switch]$Refresh,
  [switch]$DryRun,
  [switch]$SheetsOnly
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host '找不到 Node.js。請先安裝 Node.js 18 以上（https://nodejs.org/ 的 LTS 版），再重新執行。' -ForegroundColor Red
  exit 1
}
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 18) { Write-Host "Node.js 版本太舊（$major），需要 18 以上。" -ForegroundColor Red; exit 1 }
if ($DelayMs -lt 100) { Write-Host '為了不給維基太大壓力，請求間隔最少 100 毫秒，已調整為 100。' -ForegroundColor Yellow; $DelayMs = 100 }

if (-not (Test-Path -LiteralPath 'node_modules')) { Write-Host '安裝專案套件（npm ci）…'; npm ci; if ($LASTEXITCODE) { exit $LASTEXITCODE } }
if (-not (Test-Path -LiteralPath 'node_modules\sharp')) {
  Write-Host '安裝圖片轉檔套件 sharp（只裝在本機，不寫入 package.json）…'
  npm install --no-save sharp; if ($LASTEXITCODE) { exit $LASTEXITCODE }
}

if ($SheetsOnly) {
  Write-Host '把已下載的縮圖依年代合併成大圖（不連線）…'
  node data-pipeline/offline/sheets.mjs
  exit $LASTEXITCODE
}

$env:OFFLINE_DELAY = "$DelayMs"
$nodeArgs = @('data-pipeline/offline/fetch.mjs')
if ($Refresh) { $nodeArgs += '--refresh' }
if ($DryRun) { $nodeArgs += '--dry' }
$sec = [math]::Round($DelayMs / 1000, 1)
Write-Host "開始抓取：一次只送一個請求，每次間隔 $sec 秒；維基忙碌時會自動等待。可隨時 Ctrl+C 中斷，再執行會接著抓。"
$t0 = Get-Date
node @nodeArgs
if ($LASTEXITCODE) { Write-Host '中途停止；再執行一次會從中斷處繼續。' -ForegroundColor Yellow; exit $LASTEXITCODE }
if (-not $DryRun) {
  Write-Host '把縮圖依年代合併成大圖…'
  node data-pipeline/offline/sheets.mjs
  if ($LASTEXITCODE) { Write-Host '合併大圖失敗；可再執行 .\fetch-offline.ps1 -SheetsOnly 重試。' -ForegroundColor Yellow }
}
$min = [math]::Round(((Get-Date) - $t0).TotalMinutes, 1)
Write-Host "完成（$min 分鐘）。請 commit public\offline 資料夾。" -ForegroundColor Green
