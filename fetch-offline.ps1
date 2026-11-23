# 離線包：把網站用到的縮圖與說明（Wikipedia、Wikidata、Wikimedia Commons）抓到本機，
# 縮小並轉成 WebP 存進 public\offline，之後網站瀏覽時完全不再連線到維基。
#
# 用法（在專案資料夾內）：
#   powershell -ExecutionPolicy Bypass -File .\fetch-offline.ps1
#   選項：-DelayMs 500    每次請求間隔毫秒（預設 250；一次只送一個請求，數字越大對維基越友善）
#         -Refresh        全部重抓（預設只補缺少的）
#         -DryRun         只列出需要抓的數量，不連線
#         -SheetsOnly     不連線，只把已下載的縮圖依年代合併成大圖（下載進行中也可在另一個視窗執行）
#         -RoutesOnly     只更新鐵路與道路路線（OpenStreetMap）
#         -NoRoutes       不更新鐵路與道路路線
#         -Satellite      建立各地區模式的高解析衛星底圖（NASA Blue Marble，第一次下載約 300 MB，之後只補新地區）
#         -Relief         建立各地區模式的地形陰影（灰色山影；Terrain Tiles，只補新地區或舊版）
#         -CablesOnly     只更新海底電纜路線（TeleGeography，一次下載）
#         -PartyOnly      只更新墨西哥、阿根廷、巴西、印尼的州／省長政黨（Wikidata，共約 4 次查詢）
#         -PowerOnly      只更新各國模式的發電廠（OpenStreetMap，每國一次查詢，有快取）
#         -GrowthOnly     只更新世界模式的機場、港口、海纜數量（Wikidata 2 次查詢；TeleGeography 每條海纜一次、間隔 1 秒，第一次約 15 分鐘，之後只抓新海纜）
#         -Corridor       路線關係找不到的路段，改下載沿線主要道路／鐵路來求路徑（資料量大、較慢；預設不做，沿用 Natural Earth）
# 縮圖之後也會從 TeleGeography 下載海底電纜路線，依 data-pipeline\cables\cables.tsv 重建各模式的海纜（不穿越陸地、端點為實際登陸站）。
# 縮圖之後也會從 Wikidata 更新墨西哥、阿根廷、巴西、印尼模式的州／省長政黨（data-pipeline\party\fetch-party.mjs，結果寫入各模式的 party.tsv）。
# 縮圖之後會接著從 OpenStreetMap 更新各地區模式的鐵路、公路路線（data-pipeline\osm\fetch-routes.mjs）：
# 新增國家或在 infra.tsv 加了路線，再執行一次就會補上；已取得的會從快取（data-pipeline\sources\osm）直接使用。
# 中斷（Ctrl+C、斷線、關機）後再執行一次即可從中斷處接著抓；已抓過的不會再請求。
# 每次抓完會自動把縮圖依年代合併成大圖（public\offline\sheets），網站只下載瀏覽到的年代。
# 完成後 commit public\offline 即可（img 資料夾是本機快取，已列入 .gitignore，不需上傳）；圖片的作者與授權清單在 public\offline\CREDITS.md。
param(
  [int]$DelayMs = 250,
  [switch]$Refresh,
  [switch]$DryRun,
  [switch]$SheetsOnly,
  [switch]$RoutesOnly,
  [switch]$NoRoutes,
  [switch]$PartyOnly,
  [switch]$CablesOnly,
  [switch]$PowerOnly,
  [switch]$GrowthOnly,
  [switch]$Satellite,
  [switch]$Relief,
  [switch]$Corridor
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

# 鐵路與道路路線（OpenStreetMap，© OpenStreetMap 貢獻者，ODbL）
function Update-Routes {
  Write-Host '更新鐵路與道路路線（OpenStreetMap）：多條路線合併成一次查詢；Overpass 伺服器每次查詢需數秒到一分鐘。' 
  $routeArgs = @('data-pipeline/osm/fetch-routes.mjs')
  if ($Refresh) { $routeArgs += '--refresh' }
  if ($Corridor) { $routeArgs += '--corridor' }
  node @routeArgs
  if ($LASTEXITCODE) { Write-Host '路線更新中途停止；再執行一次會從快取繼續。' -ForegroundColor Yellow }
}
# 州／省長政黨（Wikidata，CC0）：每個國家一次查詢，結果有快取（data-pipeline\sources\party）
function Update-Party {
  Write-Host '更新州／省長政黨（Wikidata）：每個國家一次查詢。'
  $partyArgs = @('data-pipeline/party/fetch-party.mjs')
  if ($Refresh) { $partyArgs += '--refresh' }
  node @partyArgs
  if ($LASTEXITCODE) { Write-Host '政黨資料更新失敗；稍後可執行 .\fetch-offline.ps1 -PartyOnly 重試。' -ForegroundColor Yellow }
}
if ($RoutesOnly) { Update-Routes; exit $LASTEXITCODE }
# 海底電纜（TeleGeography Submarine Cable Map，CC BY-NC-SA 3.0）：一次下載，快取在 data-pipeline\sources\cables
function Update-Cables {
  Write-Host '更新海底電纜路線（TeleGeography）：下載一次後在本機重建，約需數分鐘。'
  $cableArgs = @('data-pipeline/cables/fetch-cables.mjs')
  if ($Refresh) { $cableArgs += '--refresh' }
  node @cableArgs
  if ($LASTEXITCODE) { Write-Host '海纜更新未完成；訊息中列出的問題處理後，可執行 .\fetch-offline.ps1 -CablesOnly 重試。' -ForegroundColor Yellow }
}
# 各國模式的發電廠：WRI 全球發電廠資料庫（已內附）加上 OpenStreetMap（ODbL）；每國一次 Overpass 查詢，快取在 data-pipeline\sources\osm-plants
function Update-Power {
  Write-Host '更新各國模式的發電廠（OpenStreetMap）：每個國家一次查詢，大國可能要數分鐘。'
  $powerArgs = @('data-pipeline/econ/fetch-osm-plants.mjs')
  if ($Refresh) { $powerArgs += '--refresh' }
  node @powerArgs
  if ($LASTEXITCODE) { Write-Host '發電廠更新未完成；可執行 .\fetch-offline.ps1 -PowerOnly 重試。' -ForegroundColor Yellow }
  node data-pipeline/econ/build-econ.mjs
}
# 世界模式的成長數字：機場、港口（Wikidata，CC0）與海纜啟用年（TeleGeography，CC BY-NC-SA 3.0），快取在 data-pipeline\sources\growth
function Update-Growth {
  Write-Host '更新世界模式的機場、港口、海底電纜數量：Wikidata 2 次查詢，TeleGeography 每條海纜一次（間隔 1 秒，只抓缺少的）。'
  $growArgs = @('data-pipeline/growth/fetch-growth.mjs')
  if ($Refresh) { $growArgs += '--refresh' }
  node @growArgs
  if ($LASTEXITCODE) { Write-Host '成長數字更新未完成；可執行 .\fetch-offline.ps1 -GrowthOnly 重試（會從中斷處繼續）。' -ForegroundColor Yellow }
}
if ($PowerOnly) { Update-Power; exit $LASTEXITCODE }
if ($GrowthOnly) { Update-Growth; exit $LASTEXITCODE }
if ($PartyOnly) { Update-Party; exit $LASTEXITCODE }
if ($CablesOnly) { Update-Cables; exit $LASTEXITCODE }
# 各地區模式的高解析衛星底圖（NASA Blue Marble: Next Generation，公有領域）：原始分幅存在 data-pipeline\sources\bmng
# 各地區模式的高解析地形（Terrain Tiles on AWS：SRTM、GMTED2010、ETOPO1 等）：下載的高程圖磚存在 data-pipeline\sources\terrain
if ($Relief) {
  Write-Host '建立各地區模式的高解析地形圖層：下載高程圖磚（每個地區數百張），再產生灰色地形陰影。'
  $reliefArgs = @('data-pipeline/relief/make-relief.mjs')
  if ($Refresh) { $reliefArgs += '--refresh' }
  node @reliefArgs
  exit $LASTEXITCODE
}
if ($Satellite) {
  Write-Host '建立各地區模式的高解析衛星底圖：先下載 Blue Marble 8 張分幅（只下載缺少的），再切出各地區的圖磚。'
  $satArgs = @('data-pipeline/satellite/make-regions.mjs')
  if ($Refresh) { $satArgs += '--refresh' }
  node @satArgs
  exit $LASTEXITCODE
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
if (-not $DryRun) { Update-Party; Update-Cables; Update-Power; Update-Growth }
if (-not $DryRun -and -not $NoRoutes) { Update-Routes }
$min = [math]::Round(((Get-Date) - $t0).TotalMinutes, 1)
Write-Host "完成（$min 分鐘）。請 commit public\offline、public\data 與 data-pipeline 資料夾。" -ForegroundColor Green
