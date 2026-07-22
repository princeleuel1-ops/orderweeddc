[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$engineRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspace = Split-Path -Parent $engineRoot
$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
    & $python.Source -3 -m unittest discover -s (Join-Path $engineRoot "tests") -v
} else {
    & (Get-Command python -ErrorAction Stop).Source -m unittest discover `
        -s (Join-Path $engineRoot "tests") -v
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& (Join-Path $engineRoot "Watch-CanaLoop.ps1") -Simulate
exit $LASTEXITCODE
