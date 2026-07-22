[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "pause", "resume", "status", "once", "dry-run")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Stop"
$bundleRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -LiteralPath (Join-Path $bundleRoot "config\governor.json") -Raw | ConvertFrom-Json
$workspaceSetting = [Environment]::ExpandEnvironmentVariables($config.workspace)
$workspace = if ([System.IO.Path]::IsPathRooted($workspaceSetting)) {
    [System.IO.Path]::GetFullPath($workspaceSetting)
} else {
    [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $bundleRoot) $workspaceSetting))
}
$runtime = Join-Path $workspace ".governor"
$control = Join-Path $runtime "control"
$stop = Join-Path $control "STOP"
$pause = Join-Path $control "PAUSE"
$status = Join-Path $runtime "status.json"
$heartbeat = Join-Path $runtime "heartbeat.json"

New-Item -ItemType Directory -Path $control -Force | Out-Null

switch ($Action) {
    "start" {
        Remove-Item -LiteralPath $stop -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $pause -Force -ErrorAction SilentlyContinue
        & (Join-Path $PSScriptRoot "Start-CanaGovernor.ps1")
    }
    "stop" {
        Set-Content -LiteralPath $stop -Value (Get-Date).ToString("o") -Encoding UTF8
        Remove-Item -LiteralPath $pause -Force -ErrorAction SilentlyContinue
        Write-Host "STOP recorded. The worker will finish its current atomic process and exit."
    }
    "pause" {
        Set-Content -LiteralPath $pause -Value (Get-Date).ToString("o") -Encoding UTF8
        Write-Host "PAUSE recorded. The worker will checkpoint and wait after its current atomic process."
    }
    "resume" {
        Remove-Item -LiteralPath $pause -Force -ErrorAction SilentlyContinue
        Write-Host "PAUSE cleared."
    }
    "once" {
        Remove-Item -LiteralPath $stop -Force -ErrorAction SilentlyContinue
        & (Join-Path $PSScriptRoot "Start-CanaGovernor.ps1") -Foreground -Once
    }
    "dry-run" {
        & (Join-Path $PSScriptRoot "Start-CanaGovernor.ps1") -Foreground -Once -DryRun
    }
    "status" {
        $result = [ordered]@{
            workspace = $workspace
            stop = Test-Path -LiteralPath $stop
            pause = Test-Path -LiteralPath $pause
            status = $null
            heartbeat = $null
        }
        if (Test-Path -LiteralPath $status -PathType Leaf) {
            try { $result.status = Get-Content -LiteralPath $status -Raw | ConvertFrom-Json } catch { $result.status = "INVALID" }
        }
        if (Test-Path -LiteralPath $heartbeat -PathType Leaf) {
            try { $result.heartbeat = Get-Content -LiteralPath $heartbeat -Raw | ConvertFrom-Json } catch { $result.heartbeat = "INVALID" }
        }
        [pscustomobject]$result | ConvertTo-Json -Depth 8
    }
}
