[CmdletBinding()]
param(
    [switch]$SeparateLaneKeys,
    [string]$BundleRoot = (Split-Path -Parent $PSScriptRoot),
    [string[]]$Keys
)

$ErrorActionPreference = "Stop"

if ($env:OS -ne "Windows_NT") {
    throw "This secret setup uses Windows DPAPI and must run on the target Windows computer."
}

$configPath = Join-Path $BundleRoot "config\governor.json"
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    throw "Governor config not found: $configPath"
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$workspaceSetting = [Environment]::ExpandEnvironmentVariables($config.workspace)
$workspace = if ([System.IO.Path]::IsPathRooted($workspaceSetting)) {
    [System.IO.Path]::GetFullPath($workspaceSetting)
} else {
    [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $BundleRoot) $workspaceSetting))
}
if (-not (Test-Path -LiteralPath $workspace -PathType Container)) {
    throw "Configured workspace does not exist: $workspace"
}

$runtime = Join-Path $workspace ".governor"
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$secretPath = Join-Path $runtime "secrets.clixml"

$secrets = [ordered]@{ }

if ($Keys -and $Keys.Count -gt 0) {
    $secKeys = @()
    foreach ($k in $Keys) {
        $secKeys += ConvertTo-SecureString $k -AsPlainText -Force
    }

    $secrets["CANA_LANE_1_API_KEY"] = $secKeys[0]
    if ($SeparateLaneKeys) {
        foreach ($lane in 2..5) {
            $idx = $lane - 1
            if ($idx -lt $secKeys.Count) {
                $secrets["CANA_LANE_${lane}_API_KEY"] = $secKeys[$idx]
            } else {
                $secrets["CANA_LANE_${lane}_API_KEY"] = $secKeys[0]
            }
        }
    } else {
        foreach ($lane in 2..5) {
            $secrets["CANA_LANE_${lane}_API_KEY"] = $secKeys[0]
        }
    }

    if ($secKeys.Count -ge 6) {
        $secrets["GEMINI_API_KEY"] = $secKeys[5]
        $config.gemini_images.enabled = $true
    } else {
        $config.gemini_images.enabled = $false
    }
} else {
    Write-Host "Enter NEW restricted keys. Nothing typed here is printed or placed in command history."
    $first = Read-Host "OpenRouter key for Lane 1" -AsSecureString
    if ($first.Length -eq 0) {
        throw "Lane 1 OpenRouter key cannot be empty."
    }

    $secrets["CANA_LANE_1_API_KEY"] = $first

    if ($SeparateLaneKeys) {
        foreach ($lane in 2..5) {
            $value = Read-Host "Legitimate separate OpenRouter key for Lane $lane" -AsSecureString
            if ($value.Length -eq 0) {
                throw "Lane $lane key cannot be empty in SeparateLaneKeys mode."
            }
            $secrets["CANA_LANE_${lane}_API_KEY"] = $value
        }
    } else {
        foreach ($lane in 2..5) {
            $secrets["CANA_LANE_${lane}_API_KEY"] = $first
        }
    }

    $gemini = Read-Host "NEW Gemini API key for optional image generation (Enter to skip)" -AsSecureString
    if ($gemini.Length -gt 0) {
        $secrets["GEMINI_API_KEY"] = $gemini
        $config.gemini_images.enabled = $true
    } else {
        $config.gemini_images.enabled = $false
    }
}

$configJson = $config | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($configPath, $configJson, (New-Object System.Text.UTF8Encoding($false)))

[pscustomobject]$secrets | Export-Clixml -LiteralPath $secretPath -Depth 4 -Force

try {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $secretPath /inheritance:r /grant:r "${identity}:(R,W)" | Out-Null
} catch {
    Write-Warning "The file is still DPAPI-encrypted, but the optional ACL tightening failed."
}

Write-Host "Encrypted credentials saved for the current Windows user."
Write-Host "They were not printed, logged, or written into the repository source."
