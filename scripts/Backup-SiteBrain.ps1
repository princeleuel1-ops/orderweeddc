# Backup-SiteBrain.ps1 - Automated Site Brain & SQLite Database Backup Utility
param(
  [string]$WorkspacePath = "C:\Users\leuel\Downloads\OWD\order-weed-dc-workspace",
  [string]$BackupDir = "C:\Users\leuel\Downloads\OWD\order-weed-dc-workspace\backups"
)

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TargetFolder = Join-Path $BackupDir "site-brain-backup-$Timestamp"

Write-Host "Creating Site Brain backup directory: $TargetFolder" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $TargetFolder | Out-Null

# 1. Back up SQLite database
$DbPath = Join-Path $WorkspacePath "apps\web\prisma\dev.db"
if (Test-Path $DbPath) {
  Copy-Item -Path $DbPath -Destination (Join-Path $TargetFolder "dev.db") -Force
  Write-Host "Backed up SQLite database (dev.db)" -ForegroundColor Green
} else {
  Write-Host "Warning: dev.db not found at $DbPath" -ForegroundColor Yellow
}

# 2. Back up Prisma Schema
$SchemaPath = Join-Path $WorkspacePath "apps\web\prisma\schema.prisma"
if (Test-Path $SchemaPath) {
  Copy-Item -Path $SchemaPath -Destination (Join-Path $TargetFolder "schema.prisma") -Force
  Write-Host "Backed up Prisma schema (schema.prisma)" -ForegroundColor Green
}

Write-Host "Site Brain backup completed successfully at $Timestamp" -ForegroundColor Green
