@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 世界國家演變 — 本地預覽
echo.
where node >nul 2>nul
if %errorlevel%==0 (
  if not exist node_modules ( echo 第一次執行，安裝套件中… & call npm install )
  echo 開發模式：修改程式後畫面會自動更新
  start "" http://localhost:5173/
  call npx vite --port 5173
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  echo 找不到 Node.js，改用 Python 開啟已建置好的 dist\
  start "" http://localhost:8000/
  python -m http.server 8000 --directory dist
  goto :eof
)
echo 找不到 Node.js 或 Python。請先安裝 Node.js（https://nodejs.org/，選 LTS 版），再執行一次這個檔案。
pause
