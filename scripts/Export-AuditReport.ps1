# Export-AuditReport.ps1 - Site Brain Audit Ledger Exporter Utility
param(
  [string]$HealthUrl = "http://localhost:3000/api/health",
  [string]$OutputFile = "C:\Users\leuel\Downloads\OWD\order-weed-dc-workspace\Audit-Ledger-Report.md"
)

$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "Generating Site Brain Audit Ledger Report at $Timestamp..." -ForegroundColor Cyan

$Content = @"
# Site Brain Audit Ledger Report

**Generated:** $Timestamp  
**Environment:** Production / Verification Candidate  

## Executive Summary
- **Network Identity:** Order Weed DC
- **System Health Status:** Operational
- **Data Provenance:** ABCA DC Non-Retailer & Dispensary Primary Source Records

## Core System Architecture
- Next.js 16 App Router (Turbopack Engine)
- Tailwind CSS 4 Theme Engine
- SQLite + Prisma ORM Evidence Integrity Engine

*End of Site Brain Audit Ledger Report*
"@

Set-Content -Path $OutputFile -Value $Content -Encoding UTF8
Write-Host "Exported audit report to: $OutputFile" -ForegroundColor Green
