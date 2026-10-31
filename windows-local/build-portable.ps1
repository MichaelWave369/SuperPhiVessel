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
  # Preserve source module-relative imports in the portable ZIP.
  New-Item -ItemType Directory -Path (Join-Path $Staging 'local-console/ui') -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $Staging 'vessie-phiserve-draft-v0.1') -Force | Out-Null
  $Map = @(
    @{From=$NodePath;To='node.exe'},
    @{From=$License;To='LICENSE.node.txt'},
    @{From=(Join-Path $PSScriptRoot 'Start-Local-Vessie.cmd');To='Start-Local-Vessie.cmd'},
    @{From=(Join-Path $PSScriptRoot 'Start-Local-Trial.cmd');To='Start-Local-Trial.cmd'},
    @{From=(Join-Path $PSScriptRoot 'Start-PhiServe-Desk.cmd');To='Start-PhiServe-Desk.cmd'},
    @{From=(Join-Path $PSScriptRoot 'START_HERE.txt');To='START_HERE.txt'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/server.mjs');To='local-console/server.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/trial-runner.mjs');To='local-console/trial-runner.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-gateway-v0.1/ollama-probe.mjs');To='local-console/ollama-probe.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/phi-gui-bridge.mjs');To='local-console/phi-gui-bridge.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-phiserve-draft-v0.1/adapter.mjs');To='vessie-phiserve-draft-v0.1/adapter.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/index.html');To='local-console/ui/index.html'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/style.css');To='local-console/ui/style.css'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/app.js');To='local-console/ui/app.js'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/review-evidence.mjs');To='local-console/ui/review-evidence.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/evidence-bench.mjs');To='local-console/ui/evidence-bench.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/portable-bench.mjs');To='local-console/ui/portable-bench.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/trial-protocols.mjs');To='local-console/ui/trial-protocols.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/protocol-cohorts.mjs');To='local-console/ui/protocol-cohorts.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/human-review-guides.mjs');To='local-console/ui/human-review-guides.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/model-desk.mjs');To='local-console/ui/model-desk.mjs'},
    @{From=(Join-Path $Root 'packages/vessie-local-console/ui/model-desk-ui.mjs');To='local-console/ui/model-desk-ui.mjs'}
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
    (Join-Path $Staging 'Start-PhiServe-Desk.cmd'),
    (Join-Path $Staging 'START_HERE.txt'),
    (Join-Path $Staging 'local-console'),
    (Join-Path $Staging 'vessie-phiserve-draft-v0.1')
  ) -DestinationPath $OutputFull -CompressionLevel Optimal
  Add-Type -AssemblyName System.IO.Compression
  $archive=[System.IO.Compression.ZipFile]::OpenRead($OutputFull)
  try {
    $names=@($archive.Entries | Where-Object { -not $_.FullName.EndsWith('/') } | ForEach-Object { $_.FullName.Replace('\\','/') } | Sort-Object)
    $expected=@(
      'LICENSE.node.txt','START_HERE.txt','Start-Local-Vessie.cmd','Start-Local-Trial.cmd',
      'Start-PhiServe-Desk.cmd','node.exe',
      'local-console/ollama-probe.mjs','local-console/server.mjs','local-console/trial-runner.mjs',
      'local-console/phi-gui-bridge.mjs',
      'local-console/ui/app.js','local-console/ui/index.html','local-console/ui/style.css',
      'local-console/ui/review-evidence.mjs','local-console/ui/evidence-bench.mjs',
      'local-console/ui/portable-bench.mjs','local-console/ui/trial-protocols.mjs',
      'local-console/ui/protocol-cohorts.mjs','local-console/ui/human-review-guides.mjs',
      'local-console/ui/model-desk.mjs','local-console/ui/model-desk-ui.mjs',
      'vessie-phiserve-draft-v0.1/adapter.mjs'
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
