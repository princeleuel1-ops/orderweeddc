[CmdletBinding()]
param(
    [string]$Workspace,
    [switch]$SeparateLaneKeys,
    [switch]$SkipScheduledTasks,
    [switch]$SkipStart,
    [string[]]$Keys
)

$ErrorActionPreference = "Stop"
if ($env:OS -ne "Windows_NT") {
    throw "This installer is intentionally Windows-only."
}

$sourceRoot = Split-Path -Parent $PSScriptRoot
if (-not $Workspace) {
    $Workspace = Split-Path -Parent $sourceRoot
}
$Workspace = [System.IO.Path]::GetFullPath([Environment]::ExpandEnvironmentVariables($Workspace))
if (-not (Test-Path -LiteralPath $Workspace -PathType Container)) {
    throw "The expected project workspace was not found: $Workspace"
}

& git -C $Workspace rev-parse --is-inside-work-tree 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { throw "The workspace is not a Git repository/worktree." }

if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Install Python 3.11 or later before running this installer."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "Install the current Node.js LTS (including npm) before running this installer."
}

if (-not (Get-Command opencode -ErrorAction SilentlyContinue)) {
    Write-Host "Installing the official OpenCode Windows CLI from npm..."
    & npm install -g opencode-ai@latest
    if ($LASTEXITCODE -ne 0) { throw "OpenCode installation failed." }
}

$destination = Join-Path $Workspace ".cana-governor-v3"
if ([System.IO.Path]::GetFullPath($sourceRoot).TrimEnd('\') -ne [System.IO.Path]::GetFullPath($destination).TrimEnd('\')) {
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    Get-ChildItem -LiteralPath $sourceRoot -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
    }
} else {
    $destination = $sourceRoot
}

$configPath = Join-Path $destination "config\governor.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$config.workspace = if (
    [System.IO.Path]::GetFullPath((Split-Path -Parent $destination)).TrimEnd('\') -eq
    [System.IO.Path]::GetFullPath($Workspace).TrimEnd('\')
) { "." } else { $Workspace }
$configJson = $config | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($configPath, $configJson, (New-Object System.Text.UTF8Encoding($false)))

$agentSource = Join-Path $destination ".opencode\agents"
$agentDestination = Join-Path $Workspace ".opencode\agents"
New-Item -ItemType Directory -Path $agentDestination -Force | Out-Null
Get-ChildItem -LiteralPath $agentSource -Filter "cana-*.md" | ForEach-Object {
    $target = Join-Path $agentDestination $_.Name
    if (Test-Path -LiteralPath $target -PathType Leaf) {
        $backup = "$target.pre-v3-$(Get-Date -Format 'yyyyMMddHHmmss').bak"
        Copy-Item -LiteralPath $target -Destination $backup
    }
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
}

$gitignore = Join-Path $Workspace ".gitignore"
if (-not (Test-Path -LiteralPath $gitignore -PathType Leaf)) {
    New-Item -ItemType File -Path $gitignore | Out-Null
}
$additions = Get-Content -LiteralPath (Join-Path $destination ".gitignore.additions")
$existing = Get-Content -LiteralPath $gitignore -ErrorAction SilentlyContinue
foreach ($line in $additions) {
    if ($line -and $existing -notcontains $line) { Add-Content -LiteralPath $gitignore -Value $line }
}

$secretsParams = @{
    BundleRoot = $destination
    SeparateLaneKeys = $SeparateLaneKeys
}
if ($Keys) {
    $secretsParams["Keys"] = $Keys
}
& (Join-Path $destination "scripts\Set-CanaSecrets.ps1") @secretsParams

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if ($config.gemini_images.enabled) {
    $python = Get-Command py -ErrorAction SilentlyContinue
    if ($python) {
        & $python.Source -3 -m pip install --user -r (Join-Path $destination "requirements-images.txt")
    } else {
        & python -m pip install --user -r (Join-Path $destination "requirements-images.txt")
    }
    if ($LASTEXITCODE -ne 0) { throw "The optional Gemini image dependency failed to install." }
}

Write-Host "Running a no-API, no-edit dry verification cycle..."
& (Join-Path $destination "scripts\Start-CanaGovernor.ps1") -Foreground -Once -DryRun
if ($LASTEXITCODE -ne 0) { throw "Dry verification failed. Review .governor\logs\governor.log." }

if (-not $SkipScheduledTasks) {
    & (Join-Path $destination "scripts\Install-CanaScheduledTasks.ps1") -BundleRoot $destination
}

if (-not $SkipStart) {
    & (Join-Path $destination "scripts\Control-CanaGovernor.ps1") start
}

Write-Host "CANA Governor v3 is installed at: $destination"
Write-Host "Status: $destination\scripts\Control-CanaGovernor.ps1 status"
