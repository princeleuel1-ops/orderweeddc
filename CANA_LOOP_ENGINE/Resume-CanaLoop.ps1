[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$engineRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspace = Split-Path -Parent $engineRoot
$runtime = Join-Path $workspace ".cana-loop"
Remove-Item -LiteralPath (Join-Path $runtime "control\MANUAL_STOP") -Force -ErrorAction SilentlyContinue
$launchPath = Join-Path $runtime "launch.json"
if (-not (Test-Path -LiteralPath $launchPath -PathType Leaf)) {
    & (Join-Path $engineRoot "Start-CanaLoop.ps1") -Hours 96 -MaxParallelLanes 5
    exit $LASTEXITCODE
}
$launch = Get-Content -LiteralPath $launchPath -Raw | ConvertFrom-Json
$parameters = @{
    MaxParallelLanes = [int]$launch.max_parallel_lanes
    MaxParallelCodex = if ($null -ne $launch.max_parallel_codex) { [int]$launch.max_parallel_codex } else { 1 }
}
if ($launch.enable_codex) { $parameters["EnableCodex"] = $true }
# Omitting a new ending parameter makes the supervisor reuse the durable
# ending_condition already in SQLite. A crash must never extend its own run.
& (Join-Path $engineRoot "Start-CanaLoop.ps1") @parameters
exit $LASTEXITCODE
