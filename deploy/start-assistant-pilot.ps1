$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
& icacls 'C:\YoConstructorAI' /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
@'
& wsl.exe -d Ubuntu -u yo-studio -- /bin/sh /opt/yo-constructor-ai-20261114/run.sh
exit $LASTEXITCODE
'@ | Set-Content -LiteralPath 'C:\YoConstructorTest-20261114\launch-assistant.ps1'
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -File C:\YoConstructorTest-20261114\launch-assistant.ps1'
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$principal=New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'Yo Constructor AI Pilot' -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Select-Object TaskName,State
Start-ScheduledTask -TaskName 'Yo Constructor AI Pilot'
& 'C:\Program Files\Tailscale\tailscale.exe' serve --bg --https=8443 http://127.0.0.1:8121
