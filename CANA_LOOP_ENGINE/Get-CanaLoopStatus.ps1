[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$engineRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspace = Split-Path -Parent $engineRoot
$runtime = Join-Path $workspace ".cana-loop"
$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
    & $python.Source -3 (Join-Path $engineRoot "supervisor.py") `
        --workspace $workspace --runtime-dir $runtime --status
} else {
    & (Get-Command python -ErrorAction Stop).Source (Join-Path $engineRoot "supervisor.py") `
        --workspace $workspace --runtime-dir $runtime --status
}
exit $LASTEXITCODE
