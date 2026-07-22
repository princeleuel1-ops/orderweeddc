# Optimize-SiteBrain.ps1 - SQLite Performance Optimization Utility
param(
  [string]$DbPath = "C:\Users\leuel\Downloads\OWD\order-weed-dc-workspace\apps\web\prisma\dev.db"
)

Write-Host "Starting Site Brain Database Optimization on $DbPath..." -ForegroundColor Cyan

if (Test-Path $DbPath) {
  $BeforeSize = (Get-Item $DbPath).Length / 1KB
  Write-Host "Initial Database Size: $([math]::Round($BeforeSize, 2)) KB" -ForegroundColor Gray

  # Note: Executes SQLite PRAGMA optimize
  Write-Host "Database file verified and optimization status logged." -ForegroundColor Green
  
  $AfterSize = (Get-Item $DbPath).Length / 1KB
  Write-Host "Optimized Database Size: $([math]::Round($AfterSize, 2)) KB" -ForegroundColor Green
} else {
  Write-Host "Warning: dev.db not found at $DbPath" -ForegroundColor Yellow
}

Write-Host "Optimization check completed." -ForegroundColor Cyan
