# 一鍵更新：維基條目對應、事實查核、離線縮圖、路線、海纜、發電廠、成長數字……依序全部跑完，最後列出結果與需要人工處理的事項。
# 每一步都會從快取接著做，中斷（Ctrl+C、斷線、關機）後再執行一次即可；某一步失敗不會中止其他步驟。
#
# 用法（在專案資料夾內）：
#   .\fetch-offline.ps1                    全部依序執行（衛星底圖與地形除外，見 -All）
#   .\fetch-offline.ps1 -Only wiki,verify  只跑指定的步驟
#   .\fetch-offline.ps1 -Skip routes       跳過指定的步驟
#   .\fetch-offline.ps1 -All               連衛星底圖與地形也一起（第一次下載約 300 MB）
#   .\fetch-offline.ps1 -List              列出所有步驟
#
# 步驟（依執行順序）：
#   wiki       依 Wikidata 對應每筆資料的中、英、日與當地語言維基條目，寫回資料並更新「關於」裡的引用統計
#   search     有找不到條目的資料時，在維基百科搜尋候選條目（data-pipeline\wiki\candidates.json，需人工確認）
#   verify     事實查核：資料的年代與位置和 Wikidata（多來自當地語言條目）比對（data-pipeline\audit\facts.tsv）
#   gaps       漏收事件檢查：各國當地語言的年表條目有、網站沒收錄的事件，並為還沒有條目的事件搜尋當地語言維基（目前臺灣、日本；data-pipeline\audit\gaps_<國>.tsv、search_<國>.tsv）
#   check      檢查網站引用的所有維基條目是否存在（data-pipeline\audit\wiki_check.tsv）
#   offline    下載縮圖與說明（Wikipedia、Wikidata、Commons），縮小轉成 WebP 存進 public\offline
#   sheets     把縮圖依年代合併成大圖（不連線）
#   party      墨西哥、阿根廷、巴西、印尼的州／省長政黨（Wikidata）
#   cables     海底電纜路線（TeleGeography）
#   power      各國模式的發電廠（OpenStreetMap）
#   growth     世界模式的機場、港口、海纜數量（Wikidata、TeleGeography）
#   routes     各地區模式的鐵路與道路路線（OpenStreetMap）
#   relief     各地區模式的地形陰影（Terrain Tiles；只在 -All 或 -Only 指定時執行）
#   satellite  各地區模式的衛星底圖（NASA Blue Marble；只在 -All 或 -Only 指定時執行）
#
# 其他選項：
#   -DelayMs 500   維基請求間隔毫秒（預設 250，最少 100；一次只送一個請求）
#   -Refresh       全部重抓（預設只補缺少的）
#   -DryRun        offline 只列出需要抓的數量，不連線
#   -Corridor      routes 找不到路線關係的路段，改下載沿線道路來求路徑（較慢）
# 舊的參數仍可用：-WikiLinks（= -Only wiki）、-WikiSearch、-WikiCheck、-SheetsOnly、-RoutesOnly、-NoRoutes（= -Skip routes）、
#   -PartyOnly、-CablesOnly、-PowerOnly、-GrowthOnly、-Satellite、-Relief。
# 完成後 commit public\offline、public\data 與 data-pipeline（img 資料夾是本機快取，已列入 .gitignore）。
param(
  [string[]]$Only,
  [string[]]$Skip,
  [switch]$All,
  [switch]$List,
  [switch]$Watch,
  [int]$DelayMs = 250,
  [switch]$Refresh,
  [switch]$DryRun,
  [switch]$Corridor,
  [switch]$SheetsOnly, [switch]$RoutesOnly, [switch]$NoRoutes, [switch]$PartyOnly, [switch]$CablesOnly, [switch]$PowerOnly,
  [switch]$GrowthOnly, [switch]$WikiCheck, [switch]$WikiLinks, [switch]$WikiSearch, [switch]$Satellite, [switch]$Relief
)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$Steps = [ordered]@{
  wiki      = '維基條目對應（中、英、日與當地語言）'
  search    = '找不到條目的資料：搜尋候選'
  verify    = '事實查核（年代、位置對照 Wikidata）'
  gaps      = '漏收事件檢查（對照當地語言年表）'
  check     = '檢查引用的維基條目是否存在'
  offline   = '離線縮圖與說明'
  sheets    = '縮圖依年代合併成大圖'
  party     = '州／省長政黨'
  cables    = '海底電纜路線'
  power     = '各國發電廠'
  growth    = '世界模式成長數字'
  routes    = '鐵路與道路路線'
  relief    = '地形陰影'
  satellite = '衛星底圖'
}
if ($List) { $Steps.GetEnumerator() | ForEach-Object { '{0,-10} {1}' -f $_.Key, $_.Value }; exit 0 }

# 舊參數 → 步驟
$legacy = @{ SheetsOnly = 'sheets'; RoutesOnly = 'routes'; PartyOnly = 'party'; CablesOnly = 'cables'; PowerOnly = 'power'; GrowthOnly = 'growth';
  WikiCheck = 'check'; WikiLinks = 'wiki'; WikiSearch = 'search'; Satellite = 'satellite'; Relief = 'relief' }
$fromLegacy = @($legacy.Keys | Where-Object { (Get-Variable $_ -ValueOnly) } | ForEach-Object { $legacy[$_] })
$want = @()
if ($Only) { $want = @($Only | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ }) }
$want += $fromLegacy
$skipSet = @($Skip | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })
if ($NoRoutes) { $skipSet += 'routes' }
foreach ($s in $want + $skipSet) { if (-not $Steps.Contains($s)) { Write-Host "沒有「$s」這個步驟；可用的步驟：$($Steps.Keys -join '、')" -ForegroundColor Red; exit 1 } }
$run = if ($want.Count) { @($Steps.Keys | Where-Object { $want -contains $_ }) }
       else { @($Steps.Keys | Where-Object { $All -or @('relief', 'satellite') -notcontains $_ }) }
$run = @($run | Where-Object { $skipSet -notcontains $_ })

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
$env:OFFLINE_DELAY = "$DelayMs"
$R = if ($Refresh) { @('--refresh') } else { @() }

# 每一步：執行 node 腳本，回傳結束代碼（0 = 成功）
# 用 Start-Process 讓 node 直接寫到這個視窗（進度列才能原地更新，Ctrl+C 也會一起停下）
# 待命模式（-Watch）另把輸出記到檔案，讓 Claude 讀得到
$script:LogFile = $null
function Say([string]$text, [string]$color = 'Gray') {
  Write-Host $text -ForegroundColor $color
  if ($script:LogFile) { Add-Content -LiteralPath $script:LogFile -Value $text -Encoding UTF8 }
}
function Invoke-Node([string[]]$a) {
  if ($script:LogFile) {
    $o = "$($script:LogFile).out"; $e = "$($script:LogFile).err"
    $p = Start-Process -FilePath 'node' -ArgumentList $a -NoNewWindow -PassThru -RedirectStandardOutput $o -RedirectStandardError $e
    $null = $p.Handle; $p.WaitForExit()
    foreach ($f in @($o, $e)) { if (Test-Path -LiteralPath $f) { foreach ($l in Get-Content -LiteralPath $f -Encoding UTF8) { Say $l } ; Remove-Item -LiteralPath $f -ErrorAction SilentlyContinue } }
    return $p.ExitCode
  }
  $p = Start-Process -FilePath 'node' -ArgumentList $a -NoNewWindow -PassThru
  $null = $p.Handle; $p.WaitForExit(); return $p.ExitCode
}
function Lines-Of([string]$f) { if (Test-Path -LiteralPath $f) { @(Get-Content -LiteralPath $f -Encoding UTF8 | Where-Object { $_ -and -not $_.StartsWith('#') }).Count } else { 0 } }
$Do = @{
  wiki = {
    $c = Invoke-Node (@('data-pipeline/wiki/fetch-wikilinks.mjs') + $R); if ($c) { return $c }
    $c = Invoke-Node @('data-pipeline/wiki/apply-wiki.mjs'); if ($c) { return $c }
    Invoke-Node @('data-pipeline/wiki/wiki-stats.mjs')
  }
  search = {
    if (-not (Lines-Of 'data-pipeline\wiki\unresolved.tsv')) { Write-Host '沒有找不到條目的資料，略過。'; return 0 }
    Invoke-Node @('data-pipeline/wiki/search-unresolved.mjs')
  }
  verify  = { Invoke-Node (@('data-pipeline/wiki/verify-facts.mjs') + $R) }
  gaps    = { $c = Invoke-Node (@('data-pipeline/wiki/timeline-gaps.mjs') + $R); if ($c) { return $c }; Invoke-Node @('data-pipeline/wiki/search-events.mjs') }
  check   = { Invoke-Node (@('data-pipeline/audit/check-wiki.mjs') + $R) }
  offline = { Invoke-Node (@('data-pipeline/offline/fetch.mjs') + $R + $(if ($DryRun) { @('--dry') } else { @() })) }
  sheets  = { if ($DryRun) { return 0 }; Invoke-Node @('data-pipeline/offline/sheets.mjs') }
  party   = { Invoke-Node (@('data-pipeline/party/fetch-party.mjs') + $R) }
  cables  = { Invoke-Node (@('data-pipeline/cables/fetch-cables.mjs') + $R) }
  power   = { $c = Invoke-Node (@('data-pipeline/econ/fetch-osm-plants.mjs') + $R); $d = Invoke-Node @('data-pipeline/econ/build-econ.mjs'); if ($c) { $c } else { $d } }
  growth  = { Invoke-Node (@('data-pipeline/growth/fetch-growth.mjs') + $R) }
  routes  = { Invoke-Node (@('data-pipeline/osm/fetch-routes.mjs') + $R + $(if ($Corridor) { @('--corridor') } else { @() })) }
  relief  = { Invoke-Node (@('data-pipeline/relief/make-relief.mjs') + $R) }
  satellite = { Invoke-Node (@('data-pipeline/satellite/make-regions.mjs') + $R) }
}

# manual.tsv 改過但還沒套用：要用到條目對應的步驟（verify、gaps、check、offline）之前先自動做 wiki
function Add-AutoWiki([string[]]$run) {
  $wl = 'data-pipeline\wiki\wikilinks.json'; $mt = 'data-pipeline\wiki\manual.tsv'
  if (($run -notcontains 'wiki') -and ($skipSet -notcontains 'wiki') -and (@($run | Where-Object { @('verify', 'gaps', 'check', 'offline') -contains $_ }).Count) -and
      (Test-Path -LiteralPath $mt) -and ((-not (Test-Path -LiteralPath $wl)) -or ((Get-Item -LiteralPath $mt).LastWriteTime -gt (Get-Item -LiteralPath $wl).LastWriteTime))) {
    Say 'manual.tsv 比條目對應的結果新，先執行 wiki 套用修改。' 'Yellow'
    return @('wiki') + $run
  }
  return $run
}
function Run-Steps([string[]]$run) {
  $sec = [math]::Round($DelayMs / 1000, 1)
  Say ("將依序執行：$($run -join ' → ')（一次只送一個請求，維基請求間隔 $sec 秒；可隨時 Ctrl+C，再執行會接著做）") 'Cyan'
  $t0 = Get-Date
  $result = [ordered]@{}
  $i = 0
  foreach ($s in $run) {
    $i++
    Say ''
    Say ("[$i/$($run.Count)] $($Steps[$s])") 'Cyan'
    $ts = Get-Date
    $blk = $Do[$s]
    try { $code = & $blk | Select-Object -Last 1 } catch { Say ($_) 'Red'; $code = 1 }
    $result[$s] = @{ ok = -not $code; min = [math]::Round(((Get-Date) - $ts).TotalMinutes, 1) }
    if ($code) { Say ("「$($Steps[$s])」沒有完成，繼續下一步；之後可執行 .\fetch-offline.ps1 -Only $s 重試（會從中斷處繼續）。") 'Yellow' }
  }

  # ---- 結果
  Say ''
  Say ('──── 結果 ────') 'Cyan'
  foreach ($s in $Steps.Keys) {
    if ($result.Contains($s)) {
      $r = $result[$s]
      Say (('  {0} {1,-10} {2}（{3} 分鐘）' -f $(if ($r.ok) { '✓' } else { '✗' }), $s, $Steps[$s], $r.min)) $(if ($r.ok) { 'Green' } else { 'Red' })
    } else { Say (('  - {0,-10} {1}（未執行）' -f $s, $Steps[$s])) 'DarkGray' }
  }
  $todo = @()
  $n = Lines-Of 'data-pipeline\wiki\manual_missing.tsv'; if ($n) { $todo += "manual.tsv 有 $n 個條目名稱在維基百科找不到（data-pipeline\wiki\manual_missing.tsv）" }
  $n = Lines-Of 'data-pipeline\wiki\unresolved.tsv';     if ($n) { $todo += "$n 筆資料找不到維基條目，候選在 data-pipeline\wiki\candidates.json" }
  $n = Lines-Of 'data-pipeline\wiki\conflicts.tsv';      if ($n) { $todo += "$n 筆資料的各語言條目指向不同項目（data-pipeline\wiki\conflicts.tsv）" }
  foreach ($g in @(Get-ChildItem -Path 'data-pipeline\audit' -Filter 'gaps_*.tsv' -ErrorAction SilentlyContinue)) { $todo += "漏收事件候選：data-pipeline\audit\$($g.Name)" }
  $n = Lines-Of 'data-pipeline\audit\facts.tsv';         if ($n) { $todo += "$n 處年代或位置和 Wikidata 不一致（data-pipeline\audit\facts.tsv）" }
  if ($todo.Count) {
    Say ''
    Say ('需要人工確認（把這些檔案交給 Claude 逐筆查證）：') 'Yellow'
    foreach ($t in $todo) { Say "  • $t" 'Yellow' }
  }
  $failed = @($result.Keys | Where-Object { -not $result[$_].ok })
  $min = [math]::Round(((Get-Date) - $t0).TotalMinutes, 1)
  Say ''
  if ($failed.Count) { Say ("共 $min 分鐘；未完成：$($failed -join '、')。執行 .\fetch-offline.ps1 -Only $($failed -join ',') 重試。") 'Yellow'; return 1 }
  Say ("完成（$min 分鐘）。請 commit public\offline、public\data 與 data-pipeline 資料夾。") 'Green'
  return 0
}

if ($Watch) {
  $req = 'data-pipeline\.run-request'; $logDir = 'data-pipeline\logs'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Write-Host '待命中：Claude 寫入 data-pipeline\.run-request 時會自動執行指定的步驟（Ctrl+C 結束）。' -ForegroundColor Cyan
  while ($true) {
    if (Test-Path -LiteralPath $req) {
      $want2 = @((Get-Content -LiteralPath $req -Raw -Encoding UTF8) -split '[,\s]+' | Where-Object { $Steps.Contains($_) })
      Remove-Item -LiteralPath $req -ErrorAction SilentlyContinue
      if ($want2.Count) {
        $script:LogFile = (Join-Path $logDir 'last-run.log'); Set-Content -LiteralPath $script:LogFile -Value '' -Encoding UTF8
        Set-Content -LiteralPath (Join-Path $logDir 'status.txt') -Value "running $($want2 -join ',') $(Get-Date -Format s)" -Encoding UTF8
        $f = Run-Steps (Add-AutoWiki $want2)
        Set-Content -LiteralPath (Join-Path $logDir 'status.txt') -Value "done $(if ($f) { 'failed' } else { 'ok' }) $(Get-Date -Format s)" -Encoding UTF8
        $script:LogFile = $null
        Write-Host '待命中…' -ForegroundColor Cyan
      }
    }
    Start-Sleep -Seconds 3
  }
}
if ($run.Count -eq 0) { Write-Host '沒有要執行的步驟。'; exit 0 }
exit (Run-Steps (Add-AutoWiki $run))
