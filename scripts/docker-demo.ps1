param([ValidateSet('fast','slow','fixed')][string]$Scenario = 'fast')
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
Push-Location $projectDir
try {
  $config = Get-Content -LiteralPath "releases/$Scenario.json" | ConvertFrom-Json
  $env:RELEASE_VERSION = $config.version
  $env:DELAY_MS = [string]$config.delayMs
  New-Item -ItemType Directory -Path reports -Force | Out-Null
  docker compose build candidate
  if ($LASTEXITCODE -ne 0) { throw 'Docker build failed' }
  docker compose up -d --force-recreate candidate
  if ($LASTEXITCODE -ne 0) { throw 'Candidate startup failed' }
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    try { $health = Invoke-RestMethod 'http://localhost:3001/health'; if ($health.version -eq $config.version) { $ready = $true; break } } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (-not $ready) { throw 'Candidate did not become ready' }
  docker compose run --rm k6
  $gateExit = $LASTEXITCODE
  Copy-Item -LiteralPath 'reports/docker-summary.json' -Destination "reports/docker-$Scenario.json" -ErrorAction SilentlyContinue
  if ($gateExit -ne 0) {
    Write-Host "BLOCKED: k6 exited $gateExit. Existing production container remains running."
    exit $gateExit
  }
  docker compose up -d --force-recreate production
  if ($LASTEXITCODE -ne 0) { throw 'Deployment failed' }
  $productionReady = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    try { $deployed = Invoke-RestMethod 'http://localhost:3100/health'; if ($deployed.version -eq $config.version) { $productionReady = $true; break } } catch {}
    Start-Sleep -Milliseconds 250
  }
  if (-not $productionReady) { throw 'Production version mismatch or startup timeout' }
  Write-Host "DEPLOYED $($config.version) at http://localhost:3100"
} finally {
  docker compose stop candidate
  Pop-Location
}
