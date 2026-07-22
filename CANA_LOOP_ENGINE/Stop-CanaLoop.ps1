[CmdletBinding()]
param(
    [ValidateRange(1, 300)]
    [int]$GraceSeconds = 60
)

$ErrorActionPreference = "Stop"
$engineRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspace = Split-Path -Parent $engineRoot
$runtime = Join-Path $workspace ".cana-loop"
$control = Join-Path $runtime "control"
New-Item -ItemType Directory -Path $control -Force | Out-Null
Set-Content -LiteralPath (Join-Path $control "MANUAL_STOP") `
    -Value (Get-Date).ToUniversalTime().ToString("o") -Encoding UTF8

function Read-Pid([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return 0 }
    $value = 0
    if ([int]::TryParse((Get-Content -LiteralPath $Path -Raw).Trim(), [ref]$value)) { return $value }
    return 0
}

$supervisorPid = Read-Pid (Join-Path $runtime "supervisor.pid")
$deadline = (Get-Date).AddSeconds($GraceSeconds)
while ($supervisorPid -gt 0 -and (Get-Process -Id $supervisorPid -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 1
}
$stillRunning = $supervisorPid -gt 0 -and $null -ne (Get-Process -Id $supervisorPid -ErrorAction SilentlyContinue)
$opencodePid = Read-Pid (Join-Path $runtime "opencode.pid")
if (-not $stillRunning -and $opencodePid -gt 0) {
    Stop-Process -Id $opencodePid -Force -ErrorAction SilentlyContinue
}
if ($stillRunning) {
    Write-Host "Safe stop is recorded. Supervisor PID $supervisorPid is finishing an atomic operation."
} else {
    Write-Host "CANA Loop stopped safely. Manual-stop protection is active."
}
& (Join-Path $engineRoot "Get-CanaLoopStatus.ps1")
