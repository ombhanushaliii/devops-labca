# Automated Performance Testing and Deployment Gating using k6

This lab tests a candidate application in staging and deploys it only when it passes a k6 acceptance gate. A slow release returns correct data but fails the latency budget, so the previous release keeps serving users.

## Start here: the local demo

Requirements: Windows and Node.js 22 or newer. No npm packages, cloud account, or database are needed. A project-local k6 2.3.0 executable is included, compiled from the unmodified official release source because this network reset the prebuilt downloads.

Open PowerShell in this folder. Run:

```powershell
node scripts/pipeline.mjs fast
```

Open **http://localhost:3100** after the command completes. You should see the product catalogue, `v1-fast`, and a deployment-history row. The server continues running after the terminal command exits.

Keep the browser open and run:

```powershell
node scripts/pipeline.mjs slow
```

The expected result is **BLOCKED** with exit code **99**. The measured p95 should exceed 500 ms while HTTP failures remain 0%. The browser still shows `v1-fast`. A failed command here is the intended demonstration.

Finally run:

```powershell
node scripts/pipeline.mjs fixed
```

The browser should now show `v3-fixed`. Each test uses 10 virtual users for 15 seconds. The whole three-run sequence takes about one minute.

Stop the demo when finished:

```powershell
node scripts/stop.mjs
```

If `tools/k6.exe` is missing, download and verify the official executable:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-k6.ps1
```

This bypass applies only to that setup process. It does not change the machine's execution policy. If k6 is already installed elsewhere, set its executable path instead:

```powershell
$env:K6_PATH = (Get-Command k6).Source
```

## What happens in a run

For the presentation, read `docs/TOOL-DEMO.md` first. It shows k6 directly in two terminals before explaining the automated gate. The slides are in `docs/Lab-Presentation.pptx`, with presenter notes.

Production defaults to port 3100 and staging to 3001. Set `PRODUCTION_PORT` and `STAGING_PORT` in PowerShell if you need different ports. The pipeline checks port availability before running k6.

1. **Build candidate:** copy the current application source and selected release configuration into a new `.runtime/releases/` snapshot.
2. **Start staging:** start that snapshot on port 3001 and wait for its health endpoint.
3. **Test performance:** k6 sends real HTTP requests to `/api/products` and evaluates thresholds.
4. **Gate deployment:** exit code 0 permits deployment. Any nonzero code skips deployment. Threshold failure code 99 means the candidate failed the acceptance gate.

After a pass, the pipeline starts the exact tested snapshot as demo production on port 3100. Changing source files after the test does not change that deployed snapshot. A failed candidate never stops the previous production process. A successful replacement briefly restarts production. This demo does not provide zero downtime.

## Acceptance criteria

| Metric | Gate | Meaning |
|---|---|---|
| `http_req_duration{endpoint:products}` | `p(95)<500` | 95th-percentile product-request duration below 500 ms |
| `http_req_failed{endpoint:products}` | `rate<0.01` | Fewer than 1% of product requests fail |
| `checks` | `rate==1` | All HTTP-status, response-shape, and release-version checks pass |
| `http_reqs` | `count>0` | The test actually sends requests |

The latency and failure budgets are strict: exactly 500 ms or exactly 1% fails. Virtual users are concurrent simulated users. They do not represent a fixed requests-per-second target.

## Demo releases

| Scenario | Version | Artificial API delay | Expected result |
|---|---|---|---|
| fast | v1-fast | 30 ms | Pass and deploy |
| slow | v2-slow | 1200 ms | Fail latency gate and skip deployment |
| fixed | v3-fixed | 30 ms | Pass and deploy |

The artificial delay represents an inefficient database query. All releases return the same correct product data. Explain this honestly during the demo: it is a controlled performance regression, rather than a real database diagnosis.

## Files to understand

```text
src/app.mjs                      Product API and release identity
src/index.html                   Product catalogue and measured history
tests/performance.js             k6 workload, checks, thresholds, report
scripts/pipeline.mjs              Local automated deployment gate
scripts/helpers.mjs               Process startup and health checks
scripts/stop.mjs                  Stops this project's production process
releases/*.json                   Controlled release scenarios
Dockerfile                       Packages the same application
compose.yaml                     Optional container demonstration
scripts/docker-demo.ps1           Docker performance gate
.github/workflows/performance-gate.yml
                                 GitHub Actions automation
reports/*.json                   Measured k6 reports from your runs
.runtime/                       Local release snapshots, logs and history
docs/                           Demo script, viva guide and task split
```

Reports contain both a readable summary and k6's raw aggregate data. History uses those measured results. The browser's catalogue timer measures one browser request and is not a load-test result.

## GitHub Actions demo

Put this folder's contents at the root of a GitHub repository, including `.github/`. The workflow runs on pushes to `main`, pull requests, and manually through the **Actions** tab.

To show the three scenarios without repeated code edits:

1. Open **Actions → Performance test and deployment gate → Run workflow**.
2. Choose `fast`, `slow`, or `fixed`.
3. Expand **k6 acceptance gate** to show the measured output.
4. For `slow`, show the failed performance job and skipped deployment job.
5. Download the `performance-report` artifact as evidence.

The performance job builds a Docker image once. Only after a successful k6 test does it save the image as an artifact. The dependent deployment job loads that same image and starts a real container, then verifies `/health`.

**Scope:** the CI demo deployment runs temporarily on the GitHub runner and ends when the job finishes. It is not a publicly hosted application. The local demo is where you show the previous release staying available. Pull requests run the performance test but do not deploy. This workflow is included as source and has not been executed on your GitHub account by this package's creator.

## Optional Docker demo

Use this after the local demo works. Docker Desktop must have its Linux engine running. Stop the Node demo first because both routes use port 3100.

```powershell
node scripts/stop.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/docker-demo.ps1 fast
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/docker-demo.ps1 slow
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/docker-demo.ps1 fixed
docker compose down
```

Docker mode displays the application and running release. Its reports are in `reports/docker-*.json`. The browser's deployment-history table is populated by the Node pipeline, so use the terminal and saved reports for Docker gate evidence. Docker mode requires internet on its first run to obtain images.

## Troubleshooting

- **k6 missing:** run the installer above or set `K6_PATH` to an absolute executable path.
- **Port 3000/3001 occupied:** close the app using the port. Use this project's stop script for its production process. The pipeline does not intentionally stop unrelated applications.
- **Stale lock:** if a pipeline was forcibly interrupted, check that it has finished and stopped staging, then remove `.runtime/pipeline.lock` before rerunning.
- **Slow release is blocked:** that is the intended result. Do not remove the thresholds or suppress the k6 exit code.
- **Fast release unexpectedly fails:** close heavy applications, rerun once, and inspect the report. Keep thresholds unchanged between comparison runs.
- **Browser briefly reconnects after a pass:** successful deployment restarts the local production process. Refresh after the command completes.
- **Docker cannot connect:** start Docker Desktop, or use the verified Node route.

## Limits and future work

This project demonstrates a fixed-budget gate under a short local workload. It does not establish application capacity, compare against a historical baseline, or measure browser rendering speed. Real deployment would need a representative workload, a persistent target, secure deployment credentials, longer tests, and monitoring after release.

## Official references

- [k6 thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
- [k6 installation](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- [Official k6 releases](https://github.com/grafana/k6/releases/tag/v2.3.0)
- [GitHub job dependencies](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs)
- [GitHub workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data)

k6 is distributed by Grafana under AGPL-3.0. The bundled executable was compiled from the unmodified official v2.3.0 source with Go 1.26.9. See `tools/k6-LICENSE.txt`, `tools/k6-BUILD.txt`, and the official release for source and licensing.
