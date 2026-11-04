# One watchdog tick. Scheduled every minute by the `peso-api-watchdog` task:
# if the API is not answering healthily on its configured port and no dev
# runner is already alive, start one. It deliberately does NOT restart a
# process that another operator is running, and it logs only when it acts.
$ErrorActionPreference = 'Stop'

$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir  = Split-Path -Parent $scriptsDir
$logFile    = Join-Path $scriptsDir 'watchdog.log'

function Log([string]$line) {
  try { Add-Content -Path $logFile -Value $line } catch { }
}

# PORT comes from server/.env (same precedence the API uses).
$port = 4000
foreach ($line in (Get-Content (Join-Path $serverDir '.env'))) {
  if ($line -match '^\s*PORT\s*=\s*(\S+)') { $port = [int]$Matches[1]; break }
}

$healthy = $false
try {
  $body = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 5
  $healthy = [bool]$body.ok
} catch { $healthy = $false }
if ($healthy) { exit 0 }

# A dev runner that is alive will take over on its own health-gated loop;
# don't stack processes on top of it.
$runner = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -match 'scripts[\\/]dev\.mjs' }
if ($runner) {
  Log "$(Get-Date -Format o) api unhealthy on port $port but a dev runner (pid $($runner.ProcessId)) is alive"
  exit 0
}

Start-Process -FilePath 'node.exe' -ArgumentList (Join-Path $scriptsDir 'dev.mjs') `
  -WorkingDirectory $serverDir -WindowStyle Hidden
Log "$(Get-Date -Format o) api was down on port $port - started a dev runner"
