<#
.SYNOPSIS
  Starts the ROLNET dev server (corepack pnpm dev, port 3000) as a detached background
  process so it keeps running when the Claude Code chat session is switched or closed.

.DESCRIPTION
  The process is created through WMI (Win32_Process.Create), so it is not a child of the
  calling shell and is not in its job object. Closing the terminal or switching chat
  sessions does not stop it. Output goes to dev-server.log in the repo root (git-ignored).

.EXAMPLE
  .\scripts\dev-server.ps1            # start (no-op if already running)
  .\scripts\dev-server.ps1 -Restart   # stop, then start
  .\scripts\dev-server.ps1 -Stop      # stop
  .\scripts\dev-server.ps1 -Status    # show whether it is running
#>
[CmdletBinding(DefaultParameterSetName = 'Start')]
param(
  [Parameter(ParameterSetName = 'Stop')][switch]$Stop,
  [Parameter(ParameterSetName = 'Restart')][switch]$Restart,
  [Parameter(ParameterSetName = 'Status')][switch]$Status,
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$log = Join-Path $root 'dev-server.log'
$url = "http://localhost:$Port"

function Get-ListenerPid {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($conn) { return $conn.OwningProcess }
  return $null
}

function Stop-DevServer {
  $listenerPid = Get-ListenerPid
  if (-not $listenerPid) {
    Write-Host "Nothing is listening on port $Port."
    return
  }
  # Kill the whole tree (node + its pnpm/cmd parents exit with it).
  & taskkill.exe /PID $listenerPid /T /F | Out-Null
  for ($i = 0; $i -lt 20 -and (Get-ListenerPid); $i++) { Start-Sleep -Milliseconds 250 }
  Write-Host "Stopped dev server (PID $listenerPid) on port $Port."
}

function Start-DevServer {
  $existing = Get-ListenerPid
  if ($existing) {
    Write-Host "Dev server already running on $url (PID $existing)."
    return
  }

  $command = "cmd.exe /c cd /d `"$root`" && corepack pnpm dev -p $Port > `"$log`" 2>&1"
  $startup = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]0 }
  $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = $command
    CurrentDirectory = $root
    ProcessStartupInformation = $startup
  }
  if ($result.ReturnValue -ne 0) {
    throw "Win32_Process.Create failed with code $($result.ReturnValue)."
  }

  Write-Host "Starting dev server on $url (log: $log) ..."
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 500
    $listenerPid = Get-ListenerPid
    if ($listenerPid) {
      Write-Host "Dev server is up on $url (PID $listenerPid). It keeps running after this window closes."
      Write-Host "Stop it with: .\scripts\dev-server.ps1 -Stop"
      return
    }
  }
  Write-Warning "Port $Port is not listening after 60s. Check $log."
}

switch ($PSCmdlet.ParameterSetName) {
  'Stop' { Stop-DevServer }
  'Restart' { Stop-DevServer; Start-DevServer }
  'Status' {
    $listenerPid = Get-ListenerPid
    if ($listenerPid) { Write-Host "Running on $url (PID $listenerPid)." } else { Write-Host "Not running." }
  }
  default { Start-DevServer }
}
