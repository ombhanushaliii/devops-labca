# Performance Testing and Deployment Gate — Demo Guide

Follow this guide during the presentation. It is written for the project in `D:\devops-labca` and the working local configuration: staging on port 3001 and production on port 3100. GitHub Actions and Docker are optional; the local demo below is the complete core demonstration.

Suggested time: 5–7 minutes. You need the project folder, one terminal, and a browser.

## What the project does

The project has a small product catalogue application. Before a candidate version becomes the live version, the pipeline starts it separately as a staging candidate and asks k6 to test it. If the candidate meets the rules, it is deployed to production at `http://localhost:3100`. If it fails, the pipeline blocks it and keeps the previous production version running.

The three prepared versions make the result visible:

| Command | Candidate behavior | Expected outcome |
|---|---|---|
| `fast` | `v1-fast`, about 30 ms of built-in delay | Passes and deploys |
| `slow` | `v2-slow`, about 1200 ms of built-in delay | Fails the speed rule; deployment is blocked |
| `fixed` | `v3-fixed`, about 30 ms of built-in delay | Passes and deploys |

The slow version still returns the correct products. Its artificial delay models a performance regression, such as a slow database query; it is a controlled example, not a diagnosis of a real database.

## Understand the numbers before you present

### Response time and milliseconds

Response time (also called latency) is how long the application takes to answer one request. The output reports this in milliseconds, abbreviated `ms`. One second is 1000 ms, so 100 ms is one tenth of a second. Smaller response times mean faster answers.

### p95: what it means

During the test, k6 records the time for each request and sorts those times from fastest to slowest. **p95 is the request time at the 95th-percentile point in that sorted list.** Roughly 95 out of every 100 requests finished in that time or less; roughly the slowest 5 took longer.

For example, if p95 is 80 ms, about 95% of measured requests finished within 80 ms. It does not say that every request took 80 ms, and it is not the average. The average can hide a small group of very slow requests, so p95 helps us see how the slower requests are behaving.

Our project's chosen rule is **p95 below 500 ms**. This is the acceptance limit for this demo, not a universal rule for all applications. A p95 of 500 ms or higher fails the rule.

### HTTP failure rate

This is the fraction of requests that failed at the HTTP/network level, for example because of a timeout or server error. The rule is **less than 1%**. A slow request can still succeed, so the slow version can show 0% HTTP failures and still fail the p95 limit.

### Checks passed

For every response, k6 checks that the server returned HTTP 200, the catalogue contains four products, and the response identifies the expected candidate version. **100% checks passed** means all those checks succeeded for the measured requests. This checks that the response is correct; it does not mean the response was fast.

### Requests and virtual users

The test uses **10 virtual users (VUs) for 15 seconds**. A virtual user is a simulated visitor repeatedly making requests; it is not a real person. `Requests` is how many requests k6 sent in total. That count can vary slightly between runs and computers.

### What PASS and BLOCKED mean

- **PASS / exit code 0:** the configured checks and performance limits passed; the pipeline may deploy the candidate.
- **BLOCKED / exit code 99:** a k6 performance threshold failed; deployment is skipped and the current production release stays live.
- The `slow` run being blocked is the expected demonstration result. It shows the gate working; it does not mean the pipeline crashed.

## Before the presentation

1. Make sure Node.js 22 or newer is installed.
2. Open a terminal in the project folder.
3. Keep a browser ready at `http://localhost:3100`.
4. On Windows, k6 is normally included as `tools\k6.exe`. On macOS, install k6 and set `K6_PATH` as shown below.
5. Close any leftover manual staging server from an earlier rehearsal with Ctrl+C. The pipeline needs staging port 3001 free.

### Windows setup (PowerShell)

Open PowerShell and run:

```powershell
cd D:\devops-labca
node --version
.\tools\k6.exe version
```

If the k6 executable is missing, install it from the project folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-k6.ps1
```

### macOS setup (Terminal)

Install Node.js and k6 once with Homebrew if needed:

```bash
brew install node@24 k6
export PATH="$(brew --prefix node@24)/bin:$PATH"
```

If Node.js 22 or newer is already installed, install only k6:

```bash
brew install k6
```

Go to the cloned project folder (replace the sample path if yours is elsewhere), check the tools, and tell the pipeline where Homebrew installed k6:

```bash
cd ~/devops-labca
node --version
k6 version
export K6_PATH="$(command -v k6)"
```

Run that `export K6_PATH=...` again in each new Terminal window before using the pipeline. The project does not need `npm install` for this demo.

## Demo flow: run these one at a time

Use the same terminal for each command. Wait for a run to finish before starting the next. The pipeline itself creates the staging candidate, runs k6, makes the decision, and deploys only on a pass.

### Step 1 — show the passing release

Run on Windows PowerShell or macOS Terminal:

```text
node scripts/pipeline.mjs fast
```

Point to the output: k6 result PASS, p95 below 500 ms, failure rate below 1%, checks passed, and `DEPLOYED: v1-fast`.

Open or refresh `http://localhost:3100`. It should show the product catalogue and `v1-fast`.

Say: “The pipeline prepared a candidate, tested it on staging, and deployed it because the measurements passed our rules.”

### Step 2 — show the blocked release

Run:

```text
node scripts/pipeline.mjs slow
```

Expected: k6 reports that the latency threshold failed, the pipeline reports **BLOCKED**, and the command may finish with exit code 99. That exit code is expected for this scenario.

Refresh `http://localhost:3100`. It should still show `v1-fast`.

Say: “The slow candidate still returns the four correct products, which is why the checks pass and HTTP failures can stay at zero. But p95 is above our 500 ms limit, so the deployment gate blocks it. The earlier `v1-fast` version remains live.”

Point to the p95 number and explain: “About 95% of requests finished in this time or less. The remaining requests took longer. Since this value is over 500 ms, it breaks our speed rule.”

### Step 3 — show the corrected release

Run:

```text
node scripts/pipeline.mjs fixed
```

Expected: the test passes and output shows `DEPLOYED: v3-fixed`.

Refresh `http://localhost:3100`. It should now show `v3-fixed`.

Say: “We removed the artificial slowdown. The same test passed, so the gate allowed the corrected version to replace production.”

### Step 4 — close the explanation

Say: “This demo shows why we test before deployment. A release can return correct data but still be too slow. k6 measures the candidate, and our pipeline uses that result to stop a slow release from replacing the working one.”

## Split the presentation between two people

- **Presenter 1:** introduce the application and explain response time, p95, HTTP failures, checks, and virtual users. Explain why `slow` is correct but too slow.
- **Presenter 2:** run the three pipeline commands, point to the PASS/BLOCKED/deployed output, and refresh the browser to show which version is live.

## Commands in one place

Run each separately from the project folder:

```text
node scripts/pipeline.mjs fast
node scripts/pipeline.mjs slow
node scripts/pipeline.mjs fixed
```

Stop the deployed demo app after the presentation:

```text
node scripts/stop.mjs
```

## Optional: show k6 directly

The three pipeline runs are enough for the core demo. If your teacher asks what k6 itself does, `docs/TOOL-DEMO.md` has an extra two-terminal walkthrough that starts a staging app manually and invokes k6 directly. This is optional and takes additional setup time.

## Do we need to run GitHub Actions?

**No.** GitHub Actions is an optional extension showing how the same performance gate could run automatically on GitHub. You can complete the presentation using the local commands and browser steps above. If you mention GitHub Actions, describe it as the included workflow unless you have separately run it and can show its result.

## Troubleshooting

- **k6 missing on Windows:** run the PowerShell installer above. **k6 missing on macOS:** run `brew install k6`, then set `K6_PATH` in that same terminal.
- **Port 3001 is occupied:** stop any manual staging server left from rehearsal with Ctrl+C, then retry.
- **Production port 3100 is occupied:** close the old project demo first. If it is a project instance, `node scripts/stop.mjs` stops the deployed demo; then run the pipeline again.
- **The slow run says BLOCKED:** that is expected. Continue to `fixed`.
- **Your measured p95 or request count differs from another run:** that is normal; the test measures real requests on the current computer. Explain whether the measured value passed the budget instead of memorizing a particular number.
- **Fast unexpectedly fails:** close unnecessary heavy apps and retry once. Do not alter the thresholds just to make a run pass.
