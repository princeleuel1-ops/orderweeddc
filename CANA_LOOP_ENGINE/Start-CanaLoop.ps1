[CmdletBinding()]
param(
    [double]$Hours,
    [switch]$UntilReleaseReady,
    [ValidateRange(1, 5)]
    [int]$MaxParallelLanes = 5,
    [switch]$EnableCodex,
    [ValidateRange(1, 1)]
    [int]$MaxParallelCodex = 1,
    [switch]$PreflightOnly,
    [switch]$Foreground,
    [switch]$Once,
    [switch]$Mock
)

$ErrorActionPreference = "Stop"
$engineRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$workspace = Split-Path -Parent $engineRoot
$runtimeName = if ($Mock) { ".cana-loop-mock" } else { ".cana-loop" }
$runtime = Join-Path $workspace $runtimeName
$logs = Join-Path $runtime "logs"
$control = Join-Path $runtime "control"
$supervisorPath = Join-Path $engineRoot "supervisor.py"
$configPath = Join-Path $engineRoot "config\runtime.json"
$lanesPath = Join-Path $engineRoot "config\lanes.json"
$opencodeConfig = Join-Path $engineRoot "config\opencode.json"
$secretPath = Join-Path $workspace ".governor\secrets.clixml"
$serverPort = 4096
$serverUrl = "http://127.0.0.1:$serverPort"

New-Item -ItemType Directory -Path $logs, $control -Force | Out-Null
Remove-Item -LiteralPath (Join-Path $control "MANUAL_STOP") -Force -ErrorAction SilentlyContinue

function Get-PythonExecutable {
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    if ($launcher) {
        $value = & $launcher.Source -3 -c "import sys; print(sys.executable)"
        if ($LASTEXITCODE -eq 0 -and $value) { return ($value | Select-Object -Last 1).Trim() }
    }
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) { return $python.Source }
    throw "Python 3.11+ was not found."
}

function Test-ProcessAlive([int]$Id) {
    if ($Id -le 0) { return $false }
    return $null -ne (Get-Process -Id $Id -ErrorAction SilentlyContinue)
}

function Test-ProcessMatches([int]$Id, [string[]]$RequiredTokens) {
    if ($Id -le 0) { return $false }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $Id" `
        -ErrorAction SilentlyContinue
    if ($null -eq $process -or [string]::IsNullOrWhiteSpace($process.CommandLine)) {
        return $false
    }
    foreach ($token in $RequiredTokens) {
        if ($process.CommandLine.IndexOf(
            $token,
            [StringComparison]::OrdinalIgnoreCase
        ) -lt 0) {
            return $false
        }
    }
    return $true
}

function Read-Pid([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return 0 }
    $value = 0
    if ([int]::TryParse((Get-Content -LiteralPath $Path -Raw).Trim(), [ref]$value)) { return $value }
    return 0
}

function Test-LocalPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(500)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Quote-ProcessArgument([string]$Value) {
    if ($Value -notmatch '[\s"]') { return $Value }
    return '"' + ($Value -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
}

$pythonExe = Get-PythonExecutable
$supervisorPidPath = Join-Path $runtime "supervisor.pid"
$opencodePidPath = Join-Path $runtime "opencode.pid"
$existingSupervisorPid = Read-Pid $supervisorPidPath
if (
    -not $PreflightOnly -and
    (Test-ProcessMatches $existingSupervisorPid @("supervisor.py", "--workspace"))
) {
    Write-Host "CANA Loop supervisor is already active with PID $existingSupervisorPid."
    & (Join-Path $engineRoot "Get-CanaLoopStatus.ps1")
    exit 0
}
if (Test-ProcessAlive $existingSupervisorPid) {
    Remove-Item -LiteralPath $supervisorPidPath -Force -ErrorAction SilentlyContinue
}

$loadedSecretReferences = @()
if (-not $Mock -and (Test-Path -LiteralPath $secretPath -PathType Leaf)) {
    $secrets = Import-Clixml -LiteralPath $secretPath
    foreach ($property in $secrets.PSObject.Properties) {
        if ($property.Name -notmatch '^CANA_LANE_[1-5]_API_KEY$') { continue }
        if ($property.Value -isnot [System.Security.SecureString]) { continue }
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($property.Value)
        try {
            $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            [Environment]::SetEnvironmentVariable($property.Name, $plain, "Process")
            $loadedSecretReferences += $property.Name
        } finally {
            if ($pointer -ne [IntPtr]::Zero) {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
            }
            $plain = $null
        }
    }
}

$randomBytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($randomBytes)
$serverPassword = [Convert]::ToBase64String($randomBytes)
[Environment]::SetEnvironmentVariable("OPENCODE_SERVER_USERNAME", "cana-local", "Process")
[Environment]::SetEnvironmentVariable("OPENCODE_SERVER_PASSWORD", $serverPassword, "Process")
[Environment]::SetEnvironmentVariable("OPENCODE_CONFIG", $opencodeConfig, "Process")
[Environment]::SetEnvironmentVariable("OPENCODE_CONFIG_DIR", (Join-Path $workspace ".opencode"), "Process")
[Environment]::SetEnvironmentVariable("OPENCODE_DISABLE_AUTOUPDATE", "true", "Process")
[Environment]::SetEnvironmentVariable("OPENCODE_AUTO_SHARE", "false", "Process")

$opencodePid = Read-Pid $opencodePidPath
if (Test-ProcessAlive $opencodePid) {
    if (Test-ProcessMatches $opencodePid @("opencode", "serve")) {
        # Server authentication is process-only by design. When no live supervisor
        # owns the matching environment, rotate the server and password together.
        Stop-Process -Id $opencodePid -Force -ErrorAction SilentlyContinue
        $stopDeadline = (Get-Date).AddSeconds(10)
        while ((Get-Date) -lt $stopDeadline -and (Test-LocalPort $serverPort)) {
            Start-Sleep -Milliseconds 200
        }
    } else {
        # Never terminate an unrelated process that inherited a stale/reused PID.
        Remove-Item -LiteralPath $opencodePidPath -Force -ErrorAction SilentlyContinue
        $opencodePid = 0
    }
}
if (Test-LocalPort $serverPort) {
    throw "Local port $serverPort is already occupied by an untracked process."
}
if (-not (Test-LocalPort $serverPort)) {
    $opencode = Get-Command opencode.ps1 -ErrorAction SilentlyContinue
    if (-not $opencode) { $opencode = Get-Command opencode -ErrorAction Stop }
    if ($opencode.Source -like "*.ps1") {
        $openCodeArgs = @(
            "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-File", $opencode.Source, "serve", "--hostname", "127.0.0.1",
            "--port", "$serverPort", "--pure", "--log-level", "WARN"
        )
        $opencodeProcess = Start-Process -FilePath "powershell.exe" `
            -ArgumentList (($openCodeArgs | ForEach-Object { Quote-ProcessArgument $_ }) -join " ") `
            -WorkingDirectory $workspace -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logs "opencode.stdout.log") `
            -RedirectStandardError (Join-Path $logs "opencode.stderr.log")
    } else {
        $openCodeArgs = @(
            "serve", "--hostname", "127.0.0.1", "--port", "$serverPort",
            "--pure", "--log-level", "WARN"
        )
        $opencodeProcess = Start-Process -FilePath $opencode.Source `
            -ArgumentList (($openCodeArgs | ForEach-Object { Quote-ProcessArgument $_ }) -join " ") `
            -WorkingDirectory $workspace -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logs "opencode.stdout.log") `
            -RedirectStandardError (Join-Path $logs "opencode.stderr.log")
    }
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline -and -not (Test-LocalPort $serverPort)) {
        Start-Sleep -Milliseconds 250
    }
    if (-not (Test-LocalPort $serverPort)) {
        throw "OpenCode headless server did not bind to localhost:$serverPort."
    }
    $listener = Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort $serverPort `
        -State Listen -ErrorAction Stop | Select-Object -First 1
    $opencodePid = [int]$listener.OwningProcess
    Set-Content -LiteralPath $opencodePidPath -Value $opencodePid -Encoding Ascii
}

$supervisorArgs = @(
    $supervisorPath,
    "--workspace", $workspace,
    "--runtime-dir", $runtime,
    "--config", $configPath,
    "--lanes", $lanesPath,
    "--server-url", $serverUrl,
    "--opencode-pid", "$opencodePid",
    "--max-parallel-lanes", "$MaxParallelLanes"
)
if ($EnableCodex) {
    $supervisorArgs += @("--enable-codex", "--max-parallel-codex", "$MaxParallelCodex")
}
if ($Hours -gt 0) { $supervisorArgs += @("--hours", "$Hours") }
if ($UntilReleaseReady) { $supervisorArgs += "--until-release-ready" }
if ($Once) { $supervisorArgs += "--once" }
if ($Mock) { $supervisorArgs += "--mock" }
if ($PreflightOnly) { $supervisorArgs += "--preflight" }

$launchRecord = [ordered]@{
    workspace = $workspace
    runtime = $runtime
    hours = if ($Hours -gt 0) { $Hours } else { $null }
    until_release_ready = [bool]$UntilReleaseReady
    max_parallel_lanes = $MaxParallelLanes
    enable_codex = [bool]$EnableCodex
    max_parallel_codex = $MaxParallelCodex
    mock = [bool]$Mock
    server_url = $serverUrl
    opencode_pid = $opencodePid
    requested_at = (Get-Date).ToUniversalTime().ToString("o")
}
$launchRecord | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $runtime "launch.json") -Encoding UTF8

try {
    if ($PreflightOnly -or $Foreground) {
        & $pythonExe @supervisorArgs
        $exitCode = $LASTEXITCODE
        exit $exitCode
    }
    $argumentLine = ($supervisorArgs | ForEach-Object { Quote-ProcessArgument $_ }) -join " "
    $supervisorProcess = Start-Process -FilePath $pythonExe -ArgumentList $argumentLine `
        -WorkingDirectory $workspace -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logs "supervisor.stdout.log") `
        -RedirectStandardError (Join-Path $logs "supervisor.stderr.log")
    Set-Content -LiteralPath $supervisorPidPath -Value $supervisorProcess.Id -Encoding Ascii
    Start-Sleep -Seconds 2
    if (-not (Test-ProcessAlive $supervisorProcess.Id)) {
        throw "CANA Loop supervisor exited during startup. Inspect .cana-loop\last_crash.json and logs."
    }
    Write-Host "CANA Loop launched. Supervisor PID $($supervisorProcess.Id); OpenCode launcher PID $opencodePid; server $serverUrl."
    & (Join-Path $engineRoot "Get-CanaLoopStatus.ps1")
} finally {
    foreach ($reference in $loadedSecretReferences) {
        [Environment]::SetEnvironmentVariable($reference, $null, "Process")
    }
    [Environment]::SetEnvironmentVariable("OPENCODE_SERVER_PASSWORD", $null, "Process")
    $serverPassword = $null
    [Array]::Clear($randomBytes, 0, $randomBytes.Length)
    if ($PreflightOnly -or ($Foreground -and $Once)) {
        Stop-Process -Id $opencodePid -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $opencodePidPath -Force -ErrorAction SilentlyContinue
    }
}
