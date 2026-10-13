# Local demo commands

Open PowerShell. Run each scenario separately and wait for the result.

```powershell
cd D:\devops-labca
node scripts/pipeline.mjs fast
```

Open **http://localhost:3100**. Expect v1-fast.

```powershell
node scripts/pipeline.mjs slow
```

Expect BLOCKED and exit code 99. Production should remain v1-fast.

```powershell
node scripts/pipeline.mjs fixed
```

Expect PASS and production v3-fixed.

To demonstrate the k6 command directly after deploying v1-fast:

```powershell
.\tools\k6.exe run -e BASE_URL=http://localhost:3100 -e EXPECTED_VERSION=v1-fast -e K6_REPORT=reports/manual-fast.json tests/performance.js
$LASTEXITCODE
```

For a complete direct k6 pass/fail demo, use `docs/TOOL-DEMO.md`. It explains how to start fast and slow staging versions in a separate terminal.

Stop production:

```powershell
node scripts/stop.mjs
```

If needed, choose different ports before running the pipeline:

```powershell
$env:PRODUCTION_PORT = '3200'
$env:STAGING_PORT = '3201'
node scripts/pipeline.mjs fast
```

Then use http://localhost:3200. The stop script reads the deployed port from its saved state.

No npm install is required. Node.js 22+ and the included `tools/k6.exe` are sufficient.
