# Watch-SiteBrain.ps1 - Automated Site Brain Watchdog Monitor
param(
  [string]$HealthUrl = "http://localhost:3000/api/health",
  [int]$IntervalSeconds = 60,
  [int]$MaxChecks = 5
)

Write-Host "Starting Site Brain Watchdog Monitor (Target: $HealthUrl)" -ForegroundColor Cyan
Write-Host "Monitoring every $IntervalSeconds seconds up to $MaxChecks checks..." -ForegroundColor Gray

for ($i = 1; $i -le $MaxChecks; $i++) {
  $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  try {
    $Response = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 5
    if ($Response.status -eq "HEALTHY") {
      Write-Host "[$Timestamp] Check $i/$MaxChecks: ✅ Site Brain Status HEALTHY (Database: $($Response.services.database.status), Retailers: $($Response.services.database.details.totalRetailers))" -ForegroundColor Green
    } else {
      Write-Host "[$Timestamp] Check $i/$MaxChecks: ⚠️ Site Brain Status UNHEALTHY" -ForegroundColor Red
    }
  } catch {
    Write-Host "[$Timestamp] Check $i/$MaxChecks: ❌ Server unreachable or error: $_" -ForegroundColor Yellow
  }

  if ($i -lt $MaxChecks) {
    Start-Sleep -Seconds $IntervalSeconds
  }
}

Write-Host "Watchdog check completed." -ForegroundColor Cyan
