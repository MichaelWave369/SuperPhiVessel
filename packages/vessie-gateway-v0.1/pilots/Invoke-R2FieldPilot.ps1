# Vessie R2 operator-owned physical pilot helper.
# This script NEVER starts a gateway, changes Windows TLS trust, or bypasses
# browser network policy. All output is local; no secrets are collected.
[CmdletBinding()]
param(
  [ValidateSet("Collect","Assess")][string]$Stage = "Collect",
  [ValidatePattern('^[a-f0-9]{32}$')][string]$TrialId = "",
  [string]$BrowserReceiptPath = "",
  [ValidateRange(1,65535)][int]$Port = 8790
)
$ErrorActionPreference = "Stop"
$pilotDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$preflight = Join-Path $pilotDir "preflight.mjs"
$generator = Join-Path $pilotDir "new-trial.mjs"
$collector = Join-Path $pilotDir "Windows-R2-LocalTrust.ps1"
$assessor = Join-Path $pilotDir "assess-field.mjs"
$script:EXIT_BLOCKED = 2

function Stop-Blocked([string]$Code) {
  Write-Host ("BLOCKED_R2_PILOT: " + $Code)
  exit $script:EXIT_BLOCKED
}
function Windows-Receipt([string]$Id) {
  return Join-Path $env:TEMP ("vessie-r2-windows-pilot-" + $Id + ".json")
}
if ($env:OS -ne "Windows_NT") { Stop-Blocked "WINDOWS_REQUIRED" }

try {
  $node = Get-Command node -ErrorAction Stop
} catch {
  Stop-Blocked "NODE_NOT_FOUND"
}
if ($node.CommandType -ne "Application") { Stop-Blocked "NODE_APPLICATION_REQUIRED" }

if ($Stage -eq "Collect") {
  if ($TrialId) { Stop-Blocked "COLLECT_REQUIRES_FRESH_TRIAL_ID" }
  # Run source-only preflight first. It does NOT inspect key contents.
  & $node.Source $preflight
  if ($LASTEXITCODE -ne 0) { Stop-Blocked "SOURCE_PREFLIGHT_BLOCKED" }

  $lines = @(& $node.Source $generator)
  if ($LASTEXITCODE -ne 0) { Stop-Blocked "TRIAL_GENERATION_FAILED" }
  $ids = @($lines | Where-Object { $_ -match '^[a-f0-9]{32}$' })
  if ($ids.Count -ne 1) { Stop-Blocked "TRIAL_GENERATION_INVALID" }
  $freshId = [string]$ids[0]
  $winReport = Windows-Receipt $freshId
  if (Test-Path -LiteralPath $winReport) { Stop-Blocked "RECEIPT_ALREADY_EXISTS" }

  Write-Host "R2 non-secret operator trial ID: $freshId"
  Write-Host "Gateway must already be running in a separate local console."
  Write-Host "Checking Windows OS TLS/refusal now without bypassing trust."
  # Run the existing field script as a child so its intentional exit 2 on
  # failed TLS controls does not terminate this wrapper mid-guidance.
  $shell = (Get-Process -Id $PID).Path
  if (-not $shell -or -not (Test-Path -LiteralPath $shell)) {
    Stop-Blocked "POWERSHELL_PROCESS_NOT_FOUND"
  }
  $quotedCollector = '"' + $collector + '"'
  $quotedReport = '"' + $winReport + '"'
  $child = Start-Process -FilePath $shell -ArgumentList @(
    "-NoProfile","-NonInteractive","-File",$quotedCollector,
    "-TrialId",$freshId,"-Port",$Port,"-OutputPath",$quotedReport
  ) -Wait -PassThru -NoNewWindow

  if ($child.ExitCode -ne 0) {
    Write-Host "Windows field check failed. Preserve its redacted BLOCKED receipt."
    Stop-Blocked "WINDOWS_TLS_OR_REFUSAL_NOT_VERIFIED"
  }

  Write-Host "WINDOWS_TLS_AND_REFUSAL_OBSERVED_NOT_BROWSER_QUALIFIED"
  Write-Host ("Non-secret trial ID for React R2 Trial ID field: " + $freshId)
  Write-Host "In Vessie React / Model Fabric, enter this trial ID and the separately"
  Write-Host "displayed ONE-USE pairing secret from the gateway console."
  Write-Host "Pair, discover models, disconnect, verify old-bearer denial, export"
  Write-Host "vessie-r2-browser-pilot.json from the browser."
  Write-Host "Then run:"
  Write-Host ('.\packages\vessie-gateway-v0.1\pilots\Invoke-R2FieldPilot.ps1 -Stage Assess -TrialId ' + $freshId)
  Write-Host "No runtime attestation, machine identity or model routing approved."
  exit 0
}

# Assess consumes only the two already-redacted reports; a matching trial
# ID must also be present inside each report, verified by assess-field.mjs.
if (-not $TrialId) { Stop-Blocked "ASSESS_REQUIRES_TRIAL_ID" }
$winReport = Windows-Receipt $TrialId
if (-not (Test-Path -LiteralPath $winReport -PathType Leaf)) {
  Stop-Blocked "WINDOWS_RECEIPT_MISSING"
}
if (-not $BrowserReceiptPath) {
  $BrowserReceiptPath = Join-Path (Join-Path $env:USERPROFILE "Downloads") "vessie-r2-browser-pilot.json"
}
if (-not (Test-Path -LiteralPath $BrowserReceiptPath -PathType Leaf)) {
  Stop-Blocked "BROWSER_RECEIPT_MISSING"
}
& $node.Source $assessor $winReport $BrowserReceiptPath
if ($LASTEXITCODE -ne 0) {
  Stop-Blocked "CORRELATED_FIELD_ASSESSMENT_BLOCKED"
}
Write-Host "R2 reports were operator-correlated and structurally reviewable."
Write-Host "NOT physically qualified, independently attested or authorized to route."
exit 0
