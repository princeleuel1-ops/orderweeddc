[CmdletBinding()]
param(
    [string]$BundleRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
if ($env:OS -ne "Windows_NT") { throw "Windows Task Scheduler is required." }

$startScript = Join-Path $BundleRoot "scripts\Start-CanaGovernor.ps1"
if (-not (Test-Path -LiteralPath $startScript -PathType Leaf)) {
    throw "Start script not found: $startScript"
}

$powerShell = (Get-Command powershell.exe).Source
$common = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$startScript`""
$governorAction = New-ScheduledTaskAction -Execute $powerShell -Argument "$common -Foreground"
$watchdogAction = New-ScheduledTaskAction -Execute $powerShell -Argument "$common -Watchdog"
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$watchdogTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName "CANA-Governor-v3" -Action $governorAction `
    -Trigger $logonTrigger -Settings $settings -Principal $principal -Force | Out-Null
Register-ScheduledTask -TaskName "CANA-Governor-Watchdog-v3" -Action $watchdogAction `
    -Trigger $watchdogTrigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Installed CANA-Governor-v3 and CANA-Governor-Watchdog-v3 for the current Windows user."
