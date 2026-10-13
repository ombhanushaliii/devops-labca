$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectDir 'tools'
$downloadDir = Join-Path $projectDir '.runtime\downloads'
$version = 'v2.3.0'
$asset = "k6-$version-windows-amd64.zip"
New-Item -ItemType Directory -Path $toolsDir, $downloadDir -Force | Out-Null
$archive = Join-Path $downloadDir $asset
$checksums = Join-Path $downloadDir 'checksums.txt'
Invoke-WebRequest "https://github.com/grafana/k6/releases/download/$version/$asset" -OutFile $archive
Invoke-WebRequest "https://github.com/grafana/k6/releases/download/$version/k6-$version-checksums.txt" -OutFile $checksums
$line = Get-Content -LiteralPath $checksums | Where-Object { $_.EndsWith($asset) }
if (-not $line) { throw 'Official checksum entry missing' }
$expected = ($line -split '\s+')[0]
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash -ne $expected) { throw 'Checksum mismatch' }
Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $downloadDir 'extracted') -Force
$binary = Get-ChildItem (Join-Path $downloadDir 'extracted') -Filter k6.exe -Recurse | Select-Object -First 1
Copy-Item -LiteralPath $binary.FullName -Destination (Join-Path $toolsDir 'k6.exe')
& (Join-Path $toolsDir 'k6.exe') version
