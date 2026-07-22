[CmdletBinding()]
param(
    [switch]$Foreground,
    [switch]$Once,
    [switch]$DryRun,
    [switch]$Preflight,
    [switch]$Watchdog
)

$ErrorActionPreference = "Stop"
$bundleRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $bundleRoot "config\governor.json"
$runnerPath = Join-Path $PSScriptRoot "cana_governor.py"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$workspaceSetting = [Environment]::ExpandEnvironmentVariables($config.workspace)
$workspace = if ([System.IO.Path]::IsPathRooted($workspaceSetting)) {
    [System.IO.Path]::GetFullPath($workspaceSetting)
} else {
    [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $bundleRoot) $workspaceSetting))
}
$runtime = Join-Path $workspace ".governor"
$control = Join-Path $runtime "control"
$secretPath = Join-Path $runtime "secrets.clixml"
$heartbeatPath = Join-Path $runtime "heartbeat.json"

New-Item -ItemType Directory -Path $control -Force | Out-Null

if (Test-Path -LiteralPath (Join-Path $control "STOP")) {
    if ($Watchdog) { exit 0 }
    throw "The durable STOP control is active. Use Control-CanaGovernor.ps1 start to clear it."
}

if ($Watchdog) {
    if (Test-Path -LiteralPath $heartbeatPath -PathType Leaf) {
        try {
            $heartbeat = Get-Content -LiteralPath $heartbeatPath -Raw | ConvertFrom-Json
            $age = (Get-Date) - ([DateTimeOffset]::Parse($heartbeat.timestamp).LocalDateTime)
            if ($age.TotalMinutes -lt 10) { exit 0 }
        } catch {
            # A malformed heartbeat is stale; the single-instance lock prevents duplicates.
        }
    }
    $Foreground = $false
}

$python = Get-Command py -ErrorAction SilentlyContinue
$pythonArgs = @()
if ($python) {
    $pythonExe = $python.Source
    $pythonArgs += "-3"
} else {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) { throw "Python 3.11+ was not found in PATH." }
    $pythonExe = $python.Source
}

if (-not $DryRun) {
    if (-not (Test-Path -LiteralPath $secretPath -PathType Leaf)) {
        throw "Encrypted secrets are missing. Run Set-CanaSecrets.ps1 first."
    }
    $secrets = Import-Clixml -LiteralPath $secretPath
    foreach ($property in $secrets.PSObject.Properties) {
        if ($property.Value -isnot [System.Security.SecureString]) { continue }
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($property.Value)
        try {
            $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            [Environment]::SetEnvironmentVariable($property.Name, $plain, "Process")
        } finally {
            if ($pointer -ne [IntPtr]::Zero) {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
            }
            $plain = $null
        }
    }
}

$pythonArgs += @($runnerPath, "--config", $configPath)
if ($Once) { $pythonArgs += "--once" }
if ($DryRun) { $pythonArgs += "--dry-run" }
if ($Preflight) { $pythonArgs += "--preflight" }

if ($Foreground) {
    & $pythonExe @pythonArgs
    exit $LASTEXITCODE
}

$quotedArgs = $pythonArgs | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
}
Start-Process -FilePath $pythonExe -ArgumentList ($quotedArgs -join " ") -WorkingDirectory $workspace -WindowStyle Hidden | Out-Null
Write-Host "CANA Governor start requested. Use Control-CanaGovernor.ps1 status for evidence."
