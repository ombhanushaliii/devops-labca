# Demonstrate k6 directly, then automate the decision

The important tool file is `tests/performance.js`. The pipeline is the automation around it. Show both parts separately so your audience understands what k6 does.

## First explain the application

`src/app.mjs` starts a small product API. `/api/products` returns four products and the release version. Before returning the data, the application waits for the release's configured delay. The fast configuration uses 30 ms. The slow configuration uses 1200 ms to model an inefficient query. The API still returns correct data in both cases.

## Explain the k6 test file

Open `tests/performance.js` and walk through these parts:

1. `options.vus`: 10 simulated concurrent users.
2. `options.duration`: a 15-second test.
3. `http.get()`: each simulated user sends an actual HTTP request to the product endpoint.
4. `check()`: validates HTTP 200, four products, and the candidate version.
5. `sleep(0.2)`: each virtual user pauses between requests.
6. `thresholds`: the pass/fail budgets for latency, failed requests, and checks.
7. `handleSummary()`: formats the measured results for the terminal and saves JSON evidence.

Say: “The k6 executable runs this JavaScript test. It simulates requests, measures the results and evaluates thresholds. The pipeline uses its exit code to decide whether to deploy.”

## Direct tool demo: two terminals

### Terminal A: run the fast candidate in staging

These commands only start the application. Keep this terminal open.

```powershell
cd D:\devops-labca
$env:PORT = '3001'
$env:APP_ENV = 'staging'
$env:RELEASE_FILE = (Resolve-Path .\releases\fast.json).Path
node .\src\app.mjs
```

### Terminal B: invoke k6 yourself

```powershell
cd D:\devops-labca
New-Item -ItemType Directory -Path reports -Force | Out-Null
$env:K6_NO_USAGE_REPORT = 'true'
$env:K6_NEW_MACHINE_READABLE_SUMMARY = 'false'
.\tools\k6.exe run -e BASE_URL=http://localhost:3001 -e EXPECTED_VERSION=v1-fast -e K6_REPORT=reports/manual-fast.json tests/performance.js
$LASTEXITCODE
```

Explain the command: `k6.exe` is the tool, `run` executes the test, `-e` passes test variables, and `tests/performance.js` defines the workload and acceptance rules.

Show the actual output: PASS, p95 below 500 ms, 0% HTTP failures, 100% passed checks and exit code 0. The measured values can vary between runs.

### Terminal A: switch to the slow application

Press **Ctrl+C** to stop the fast staging server. Then run:

```powershell
$env:RELEASE_FILE = (Resolve-Path .\releases\slow.json).Path
node .\src\app.mjs
```

### Terminal B: run the same test against the slow release

```powershell
.\tools\k6.exe run -e BASE_URL=http://localhost:3001 -e EXPECTED_VERSION=v2-slow -e K6_REPORT=reports/manual-slow.json tests/performance.js
$LASTEXITCODE
```

Show that HTTP failures are still 0% and checks still pass, but p95 exceeds 500 ms. The latency threshold fails and the exit code is 99.

Say: “The application returns correct data, but it misses the response-time budget. k6 detects this through a threshold.”

Stop the staging server with **Ctrl+C** before using the automated pipeline. Port 3001 must be free.

## Then show deployment gating

Use **Terminal B** for the pipeline so the application environment variables from Terminal A do not carry into your explanation.

Run each command separately and show its result before moving on:

```powershell
node scripts/pipeline.mjs fast
node scripts/pipeline.mjs slow
node scripts/pipeline.mjs fixed
```

Open **http://localhost:3100**. Show v1-fast after the first run, v1-fast remaining after the blocked run, and v3-fixed after the corrected run.

In `scripts/pipeline.mjs`, point to `runK6()` and `if (exitCode !== 0)`. That condition is the deployment gate. The passing branch starts the tested snapshot as production. The failed branch records the result and leaves production untouched.

## What the scripts add

| File | Responsibility |
|---|---|
| `src/app.mjs` | Application HTTP server |
| `tests/performance.js` | k6 workload, checks, thresholds and report |
| `scripts/pipeline.mjs` | Starts staging, runs k6 and gates deployment |
| `scripts/helpers.mjs` | Port checks, process management and health checks |
| `scripts/stop.mjs` | Stops the tracked production process |
| `scripts/install-k6.ps1` | Optional download of the official k6 binary |

The Dockerfile packages the application. The GitHub Actions workflow runs a performance job and allows the dependent deployment job only after success. Show those as the CI extension after the local tool demo is working.
