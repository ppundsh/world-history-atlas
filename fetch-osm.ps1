# 只更新鐵路與道路路線（OpenStreetMap）。完整流程已整合進 fetch-offline.ps1（抓取離線檔案.bat），平常用那個即可。
#   powershell -ExecutionPolicy Bypass -File .\fetch-osm.ps1 [-Refresh]
param([switch]$Refresh)
Set-Location -LiteralPath $PSScriptRoot
$a = @('-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'fetch-offline.ps1'), '-RoutesOnly')
if ($Refresh) { $a += '-Refresh' }
powershell @a
exit $LASTEXITCODE
