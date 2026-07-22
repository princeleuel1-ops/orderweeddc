$ErrorActionPreference = "Stop"
foreach ($name in @("CANA-Governor-v3", "CANA-Governor-Watchdog-v3")) {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
    }
}
Write-Host "CANA scheduled tasks removed. Project files, state, receipts, and secrets were preserved."
