[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$engineRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$watchScript = Join-Path $engineRoot "Watch-CanaLoop.ps1"
$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$watchScript`""
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments
$existing = Get-ScheduledTask -TaskName "CANA-Loop-Supervisor", "CANA-Loop-Watchdog" `
    -ErrorAction SilentlyContinue
$existing | Stop-ScheduledTask -ErrorAction SilentlyContinue
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive -RunLevel Limited

$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
Register-ScheduledTask -TaskName "CANA-Loop-Supervisor" -Action $action `
    -Trigger $logonTrigger -Settings $settings -Principal $principal -Force | Out-Null

$intervalTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
Register-ScheduledTask -TaskName "CANA-Loop-Watchdog" -Action $action `
    -Trigger $intervalTrigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Installed CANA-Loop-Supervisor and CANA-Loop-Watchdog scheduled tasks."
Get-ScheduledTask -TaskName "CANA-Loop-Supervisor", "CANA-Loop-Watchdog" |
    Select-Object TaskName, State
