@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
echo ============================================
echo  推送到 GitHub 公开仓库
echo ============================================
echo.
if "%GITHUB_TOKEN%"=="" (
  echo 请粘贴 GitHub Personal Access Token ^(需 repo 权限^):
  set /p GITHUB_TOKEN=Token:
)
if "%GITHUB_TOKEN%"=="" (
  echo [ERROR] 未提供 token，已取消。
  pause
  exit /b 1
)
echo.
python -u "scripts\push_github.py" mxd-paperdoll-assets
echo.
pause
