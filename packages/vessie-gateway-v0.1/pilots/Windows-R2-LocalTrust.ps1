# Vessie Gateway R2 Windows local trust / refusal pilot.
# Run only after starting the R2 browser gateway on this machine.
# No pairing code, bearer token, model name, username, or hostname is read or saved.
[CmdletBinding()]
param(
  [ValidateRange(1,65535)][int]$Port = 8790,
  [string]$OutputPath = (Join-Path $env:TEMP "vessie-r2-windows-pilot.json")
)
$ErrorActionPreference = "Stop"
$uri = "https://127.0.0.1:$Port/v1/status"
$origin = "https://michaelwave369.github.io"
$schema = "superphivessel.gateway.r2.windows-pilot.v0.1"
$results = @()
function Add-Check([string]$Check, [string]$State, [string]$Detail) {
  $script:results += [ordered]@{
    check = $Check
    result = $State
    detail = $Detail
  }
}
function Fetch-Status([string]$Origin, [string]$Url) {
  $req = [System.Net.HttpWebRequest]::Create($Url)
  $req.Method = "GET"
  $req.Timeout = 6000
  $req.ReadWriteTimeout = 6000
  $req.AllowAutoRedirect = $false
  $req.Headers.Add("Origin", $Origin)
  try {
    $response = [System.Net.HttpWebResponse]$req.GetResponse()
    try { return @{ code = [int]$response.StatusCode; error = $null } }
    finally { $response.Close() }
  } catch [System.Net.WebException] {
    if ($null -ne $_.Exception.Response) {
      $response = [System.Net.HttpWebResponse]$_.Exception.Response
      try { return @{ code = [int]$response.StatusCode; error = $null } }
      finally { $response.Close() }
    }
    # Intentionally do not store raw exception text, device paths or IP addresses.
    return @{ code = $null; error = "TLS_OR_TRANSPORT_UNAVAILABLE" }
  }
}
$wasCustomTlsCallback = $null -ne [System.Net.ServicePointManager]::ServerCertificateValidationCallback
if ($wasCustomTlsCallback) {
  Add-Check "WINDOWS_OS_TLS_TRUST" "BLOCKED" "Non-default global certificate-validation callback detected; cannot establish strict TLS trust"
  Add-Check "UNAUTHORIZED_REFUSAL" "NOT_RUN" "TLS trust prerequisite failed"
  Add-Check "WRONG_ORIGIN_REFUSAL" "NOT_RUN" "TLS trust prerequisite failed"
} else {
  # HttpWebRequest uses Windows certificate trust, including hostname/IP matching.
  # Never use -SkipCertificateCheck or accept invalid certificates here.
  $allowed = Fetch-Status $origin $uri
  if ($allowed.error) {
    Add-Check "WINDOWS_OS_TLS_TRUST" "BLOCKED" "Strict trusted TLS connection could not be established"
    Add-Check "UNAUTHORIZED_REFUSAL" "NOT_RUN" "TLS trust prerequisite failed"
    Add-Check "WRONG_ORIGIN_REFUSAL" "NOT_RUN" "TLS trust prerequisite failed"
  } else {
    Add-Check "WINDOWS_OS_TLS_TRUST" "PASS" "HTTPS handshake completed with default Windows certificate validation"
    Add-Check "UNAUTHORIZED_REFUSAL" $(if ($allowed.code -eq 403) {"PASS"} else {"FAIL"}) "Expected HTTP 403 without any bearer token"
    $wrong = Fetch-Status "https://untrusted.example.invalid" $uri
    Add-Check "WRONG_ORIGIN_REFUSAL" $(if ($wrong.code -eq 403) {"PASS"} else {"FAIL"}) "Expected HTTP 403 for an unapproved Origin"
  }
}
$failed = @($results | Where-Object { $_.result -ne "PASS" }).Count -gt 0
$receipt = [ordered]@{
  schema = $schema
  observation_source = "OPERATOR_WINDOWS_POWERSHELL_LOCAL_TEST"
  generated_at_utc = (Get-Date).ToUniversalTime().ToString("o")
  fixture = $false
  platform = "WINDOWS"
  gateway_target = "HTTPS_LOOPBACK"
  check_count = $results.Count
  checks = $results
  result = $(if ($failed) { "BLOCKED_FIELD_QUALIFICATION" } else { "LOCAL_TLS_AND_REFUSAL_PASS_BROWSER_PENDING" })
  browser_certificate_trust_qualified = $false
  browser_private_network_qualified = $false
  browser_pairing_qualified = $false
  real_ollama_qualified = $false
  operator_promotion_approved = $false
  authority_granted = $false
  keys_included = $false
  session_tokens_included = $false
  raw_model_names_included = $false
}
$json = $receipt | ConvertTo-Json -Depth 8
$target = [System.IO.Path]::GetFullPath($OutputPath)
[System.IO.File]::WriteAllText($target, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output $json
Write-Host "Redacted R2 Windows local TLS receipt written to $target"
if ($failed) { exit 2 }
