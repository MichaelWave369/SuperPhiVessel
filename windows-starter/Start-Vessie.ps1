# SuperPhiVessel Windows Starter v0.1.
# Read-only; no local repository, Git, Node, certificates or admin rights required.
# Never installs a CA, changes firewall/execution policy, writes files or
# transmits local model inventory to GitHub Pages.
[CmdletBinding()]
param(
  [switch]$NoBrowser,
  [switch]$SkipLocalProbe
)
$ErrorActionPreference = "Stop"
$Cockpit = "https://michaelwave369.github.io/SuperPhiVessel/vessie/"
$MaxBytes = 524288
$MaxModels = 256
$Endpoint = "http://127.0.0.1:11434/api/tags"

function Get-LocalOllamaSummary {
  $client = $null
  $handler = $null
  $response = $null
  $bodyStream = $null
  $bufferStream = $null
  try {
    Add-Type -AssemblyName System.Net.Http
    $handler = New-Object System.Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $handler.UseProxy = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(4)
    $url = [System.Uri]$Endpoint
    $response = $client.GetAsync($url, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne 200) { return @{ status="UNAVAILABLE_OR_HTTP_ERROR"; count=0; models=@() } }
    $length = $response.Content.Headers.ContentLength
    if ($null -ne $length -and $length -gt $MaxBytes) { return @{ status="RESPONSE_TOO_LARGE"; count=0; models=@() } }
    $bodyStream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $bufferStream = New-Object System.IO.MemoryStream
    $block = New-Object 'byte[]' 8192
    $total = 0
    while (($read = $bodyStream.Read($block, 0, $block.Length)) -gt 0) {
      $total += $read
      if ($total -gt $MaxBytes) { return @{ status="RESPONSE_TOO_LARGE"; count=0; models=@() } }
      $bufferStream.Write($block, 0, $read)
    }
    $json = [System.Text.Encoding]::UTF8.GetString($bufferStream.ToArray()) | ConvertFrom-Json
    if ($null -eq $json -or $null -eq $json.models) {
      return @{ status="INVALID_LOCAL_RESPONSE"; count=0; models=@() }
    }
    $inventory = @($json.models)
    if ($inventory.Count -gt $MaxModels) {
      return @{ status="MODEL_LIMIT_EXCEEDED"; count=0; models=@() }
    }
    $names = @()
    foreach ($entry in $inventory) {
      $name = [string]$entry.name
      if ($name.Length -gt 0 -and $name.Length -le 128 -and $name -notmatch '[\x00-\x1f\x7f]') {
        $names += $name
      }
    }
    return @{ status="AVAILABLE_READ_ONLY"; count=$names.Count; models=@($names | Sort-Object -Unique) }
  } catch {
    # Raw errors might contain workstation details. Never echo them.
    return @{ status="UNAVAILABLE_OR_INVALID"; count=0; models=@() }
  } finally {
    if ($null -ne $bufferStream) { $bufferStream.Dispose() }
    if ($null -ne $bodyStream) { $bodyStream.Dispose() }
    if ($null -ne $response) { $response.Dispose() }
    if ($null -ne $client) { $client.Dispose() }
    if ($null -ne $handler) { $handler.Dispose() }
  }
}

Write-Host ""
Write-Host "====================================================="
Write-Host " SUPERPHIVESSEL  |  WINDOWS STARTER  |  READ ONLY"
Write-Host "====================================================="
Write-Host "Nothing is being installed or changed on your PC."
Write-Host "Local model names are shown only in this terminal, never uploaded."
Write-Host "The hosted React cockpit is a separate web interface."
Write-Host ""

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  Write-Host "WINDOWS_REQUIRED: this launcher is for Windows."
  exit 2
}

if ($SkipLocalProbe) {
  Write-Host "Local Ollama probe: NOT_TESTED (explicit test mode)"
} else {
  $read = Get-LocalOllamaSummary
  Write-Host ("Local Ollama probe: " + $read.status)
  if ($read.status -eq "AVAILABLE_READ_ONLY") {
    Write-Host ("Installed models discovered: " + $read.count)
    foreach ($name in $read.models) { Write-Host ("  - " + $name) }
    Write-Host "Discovered models are NOT approved for Vessie routing or execution."
  } else {
    Write-Host "No usable Ollama inventory was found on 127.0.0.1:11434."
    Write-Host "That's okay. The hosted Vessie cockpit still opens."
    Write-Host "Optional local models: https://ollama.com/download/windows"
  }
}

Write-Host ""
Write-Host "Hosted Vessie cockpit: $Cockpit"
Write-Host "This launcher does NOT pair your browser with the local model gateway."
Write-Host "The secure R2 pairing pilot is an optional, later setup step."
if ($NoBrowser) {
  Write-Host "Browser launch: NOT_TESTED (explicit test mode)"
} else {
  try {
    Start-Process -FilePath $Cockpit | Out-Null
    Write-Host "Browser launch requested. Use the link above if it did not open."
  } catch {
    Write-Host "Browser launch unavailable. Open the link above manually."
  }
}
Write-Host ""
Write-Host "STARTER_COMPLETE_NO_AUTHORITY: no local routing, inference or permissions granted."
exit 0
