[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
foreach ($taskName in "CANA-Loop-Supervisor", "CANA-Loop-Watchdog") {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
}
Write-Host "CANA Loop scheduled tasks removed. Runtime state and evidence were preserved."
