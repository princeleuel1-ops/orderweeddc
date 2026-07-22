[CmdletBinding()]
param(
    [switch]$Simulate
)

$ErrorActionPreference = "Stop"
$engineRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspace = Split-Path -Parent $engineRoot
$runtime = Join-Path $workspace ".cana-loop"
$arguments = @(
    "-3", (Join-Path $engineRoot "watchdog.py"),
    "--workspace", $workspace,
    "--runtime-dir", $runtime
)
if ($Simulate) { $arguments += "--simulate" }
$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
    & $python.Source @arguments
} else {
    $arguments = $arguments[1..($arguments.Count - 1)]
    & (Get-Command python -ErrorAction Stop).Source @arguments
}
exit $LASTEXITCODE
