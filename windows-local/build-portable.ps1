# Windows-only portable ZIP builder for Node runtime + bounded read-only local console.
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$OutputPath,
 [string]$NodePath = ""
)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $NodePath) {
  $node = Get-Command node.exe -ErrorAction Stop
  $NodePath = $node.Source
}
$NodePath = (Resolve-Path -LiteralPath $NodePath).Path
if ([System.IO.Path]::GetFileName($NodePath) -ne 'node.exe') { throw 'NODE_BINARY_REQUIRED' }
$NodeDir = Split-Path -Parent $NodePath
$License = Join-Path $NodeDir 'LICENSE'
if (-not (Test-Path -LiteralPath $License -PathType Leaf)) {
  throw 'NODE_DISTRIBUTION_LICENSE_MISSING'
}
$OutputFull = [System.IO.Path]::GetFullPath($OutputPath)
if ([System.IO.Path]::GetExtension($OutputFull) -ne '.zip') { throw 'ZIP_OUTPUT_REQUIRED' }
$Temp = Join-Path ([System.IO.Path]::GetTempPath()) ('vessie-local-package-' + [guid]::NewGuid().ToString('N'))
$Staging = Join-Path $Temp 'bundle'
try {
  New-Item -ItemType Directory -Path (Join-Path $Staging 'ui') -Force | Out-Null
  $Map = @(
    @{From=$NodePath;To='node.exe'},
    @{From=$License;To='LICENSE.node.txt'},
    @{From=(Join-Path $PSScriptRoot 'Start-Local-Vessie.cmd');To='Start-Local-Vessie.cmd'},
    @{From=(Join-Path $PSScriptRoot 'Start-Local-Trial.cmd');To='Start-Local-Trial.cmd'},
    @{From=(Join-Path $PSScriptRoot 'START_HERE.txt');To='START_HERE.txt'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/server.mjs');To='server.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/trial-runner.mjs');To='trial-runner.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-gateway-v0.1/ollama-probe.mjs');To='ollama-probe.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/index.html');To='ui/index.html'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/style.css');To='ui/style.css'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/app.js');To='ui/app.js'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/review-evidence.mjs');To='ui/review-evidence.mjs'}
  )
  foreach ($entry in $Map) {
    if (-not (Test-Path -LiteralPath $entry.From -PathType Leaf)) { throw 'ALLOWLIST_INPUT_MISSING' }
    if ((Get-Item -LiteralPath $entry.From).Attributes -band [IO.FileAttributes]::ReparsePoint) {
      throw 'ALLOWLIST_SYMLINK_REJECTED'
    }
    $Destination = Join-Path $Staging $entry.To
    Copy-Item -LiteralPath $entry.From -Destination $Destination -ErrorAction Stop
  }
  $OutputDir = Split-Path -Parent $OutputFull
  if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
  }
  if (Test-Path -LiteralPath $OutputFull) { Remove-Item -LiteralPath $OutputFull -Force }
  Compress-Archive -LiteralPath @(
    (Join-Path $Staging 'node.exe'),
    (Join-Path $Staging 'LICENSE.node.txt'),
    (Join-Path $Staging 'Start-Local-Vessie.cmd'),
    (Join-Path $Staging 'Start-Local-Trial.cmd'),
    (Join-Path $Staging 'START_HERE.txt'),
    (Join-Path $Staging 'server.mjs'),
    (Join-Path $Staging 'trial-runner.mjs'),
    (Join-Path $Staging 'ollama-probe.mjs'),
    (Join-Path $Staging 'ui')
  ) -DestinationPath $OutputFull -CompressionLevel Optimal
  Add-Type -AssemblyName System.IO.Compression
  $archive=[System.IO.Compression.ZipFile]::OpenRead($OutputFull)
  try {
    $names=@($archive.Entries | Where-Object { -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName.Replace('\\','/') } | Sort-Object)
    $expected=@(
      'LICENSE.node.txt','START_HERE.txt','Start-Local-Vessie.cmd','Start-Local-Trial.cmd',
      'node.exe','ollama-probe.mjs','server.mjs','trial-runner.mjs','ui/app.js',
      'ui/index.html','ui/style.css','ui/review-evidence.mjs'
    ) | Sort-Object
    if ((Compare-Object $names $expected).Count -ne 0) { throw 'ARCHIVE_ALLOWLIST_MISMATCH' }
  } finally { $archive.Dispose() }
  $Hash=(Get-FileHash -LiteralPath $OutputFull -Algorithm SHA256).Hash.ToLowerInvariant()
  Write-Host 'VESSIE_PORTABLE_WINDOWS_ZIP_PASS'
  Write-Host ('SHA256 ' + $Hash)
  Write-Host ('SIZE_BYTES ' + (Get-Item -LiteralPath $OutputFull).Length)
} finally {
  if (Test-Path -LiteralPath $Temp) {
    Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
