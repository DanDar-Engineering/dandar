#Requires -RunAsAdministrator
# Forward the browser-facing erxes ports (core-ui 3001, plugin UI 3099,
# gateway 4000) from this PC's network address into WSL, so phones on the same
# wifi can open erxes started with `start-all.sh --host`. WSL's NAT address
# changes after a reboot; start-all.sh prints this command again when the
# forward is stale. The plugin API (3399) stays private: it trusts the
# gateway's identity headers. In an admin PowerShell:
#   powershell -ExecutionPolicy Bypass -File phone-forward.ps1 -WslIp <ip>
#   powershell -ExecutionPolicy Bypass -File phone-forward.ps1 -Remove
param(
  [string]$WslIp = ((wsl.exe -d Ubuntu-24.04 -e hostname -I) -split '\s+')[0],
  [switch]$Remove
)
$ErrorActionPreference = 'Stop'
$ports = 3001, 3099, 4000
$rule = 'DanDar dev (phone access)'

foreach ($port in $ports) {
  netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$port | Out-Null
}
Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
if ($Remove) {
  'Phone access removed.'
  return
}

foreach ($port in $ports) {
  netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$port connectaddress=$WslIp connectport=$port | Out-Null
}
# LocalSubnet: only devices on the same network, whatever its profile.
New-NetFirewallRule -DisplayName $rule -Direction Inbound -Protocol TCP -LocalPort $ports -RemoteAddress LocalSubnet -Action Allow | Out-Null
"Forwarding ports $($ports -join ', ') to WSL at $WslIp."
