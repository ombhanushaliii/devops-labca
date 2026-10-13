# Presentation and live demo

Suggested duration: 8–10 minutes. Presenter A explains the application and demonstrates k6 directly. Presenter B explains the pipeline and operates it. Both presenters should run the demo once before class.

## Before class

1. Run the fast scenario once and verify that http://localhost:3100 opens.
2. Keep the terminal and browser ready side by side.
3. Open `tests/performance.js` and `scripts/pipeline.mjs` for questions.
4. Keep a previous report open as backup evidence. Do not describe a saved report as a live run.
5. Use the local demo first. Show GitHub Actions only if you have already pushed and rehearsed it.

## Presenter A: opening and application, about 2 minutes

“Our project is Automated Performance Testing and Deployment Gating using k6. An application can return the correct output and still be too slow. We test a candidate release before allowing it to replace the running application.”

“This is our product catalogue. The API returns four products. The release label tells us which version is currently serving users. Staging runs separately on port 3001, while demo production runs on port 3100.”

“k6 simulates ten concurrent users for fifteen seconds. It checks response time, request failures and whether the API returns the expected data and release version.”

## Presenter A: threshold explanation, about 1 minute

Open `tests/performance.js`.

“Our latency requirement is p95 below 500 milliseconds. p95 describes the slower end of the request durations instead of only the average. We also require fewer than one percent failed requests and all response checks to pass.”

“A correct HTTP 200 response alone does not guarantee acceptable performance.”

## Presenter A: direct k6 demonstration, about 1–2 minutes

Follow `docs/TOOL-DEMO.md`: start the fast staging application in Terminal A and run `tools/k6.exe run ... tests/performance.js` in Terminal B. Show exit code 0. Switch the application to the slow configuration and run the same k6 test with the slow expected version. Show correct responses, failed latency and exit code 99.

Explain: “The k6 tool executes our JavaScript workload and evaluates the thresholds. Our pipeline uses its exit code to decide whether deployment can proceed.”

Stop the manual staging server with Ctrl+C before handing over so port 3001 is free.

Hand over: “My teammate will now show how we automate the deployment decision using this result.”

## Presenter B: passing release, about 1 minute

Run:

```powershell
node scripts/pipeline.mjs fast
```

“The pipeline snapshots the candidate, starts it in staging, runs k6, and evaluates the result. Deployment happens only after k6 exits successfully. This fast release has a controlled 30-millisecond delay.”

Show the p95 and request-failure values, the PASS result, and `v1-fast` in the browser.

## Presenter B: blocked release, about 1 minute

Run:

```powershell
node scripts/pipeline.mjs slow
```

“We have introduced a 1.2-second delay to model an inefficient query. This version still returns the correct catalogue.”

After the result:

“The response checks passed and HTTP failures are zero, but p95 exceeded our latency budget. k6 returned exit code 99, so the pipeline skipped deployment.”

Point to the browser:

“The candidate is v2-slow. The running application remains v1-fast. The failed test did not stop the previous release.”

## Presenter B: corrected release, about 1 minute

Run:

```powershell
node scripts/pipeline.mjs fixed
```

“We removed the delay and submitted v3-fixed. The same test and thresholds now pass, so the gate allows deployment.”

Show `v3-fixed` in the browser and all three rows of deployment history.

## Both: CI and conclusion, about 1 minute

Presenter B: “The GitHub workflow automates the same rule. The deployment job depends on the performance job. A failed performance test prevents the deployment job from running. A passing job provides the exact tested Docker image.”

Presenter A: “Our demonstration uses a fixed performance budget, a short local workload, and a controlled slowdown. A larger system would need realistic traffic and a persistent deployment environment.”

Finish: “We demonstrated that a release can be functionally correct but fail performance requirements, and that this failure can automatically prevent deployment.”

## Work split

| Presenter A | Presenter B |
|---|---|
| Application and API explanation | Staging and production explanation |
| k6 workload and response checks | Pipeline implementation and exit codes |
| Thresholds and metrics | Docker and GitHub Actions |
| Open source/report for viva questions | Operate the three live scenarios |

Use this as a presentation split. If asked who implemented the code, describe the assistance and work you actually performed rather than claiming work you did not do.
