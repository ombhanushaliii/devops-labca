# Concepts and likely viva questions

**What is k6?** An open-source performance testing tool that executes JavaScript test scripts and sends requests as simulated users. It has its own runtime. Node.js runs our application and pipeline, while the k6 executable runs the test.

**What problem does this project solve?** It prevents a release from being deployed when it fails an agreed performance budget, even when it returns correct data.

**What is deployment gating?** A rule that allows or blocks deployment according to a test result. Our pipeline checks the k6 process exit code.

**What is p95?** The 95th percentile of request durations. It shows a point near the slow end of the observed requests. Our gate requires that value to stay below 500 ms.

**Why not just average response time?** An average can hide a group of slow requests. A percentile gives more information about the slower responses that users experience.

**What are virtual users?** Concurrent simulated users executing the test. Each user sends a product request and waits 0.2 seconds before another iteration. Ten VUs does not mean ten requests per second.

**What is the difference between checks and thresholds?** Checks validate individual responses. Thresholds decide whether aggregated test results meet acceptance criteria. Check failures alone do not make the process fail unless a threshold covers the check metric. We added `checks: ['rate==1']` for that reason.

**What does exit code 99 mean?** k6 failed one or more thresholds. The pipeline returns the failure and skips deployment. Other nonzero codes also block deployment because they may indicate a test or configuration error.

**Why does the slow release still have zero HTTP failures?** It responds successfully with HTTP 200 and correct data. Its problem is latency, so only the response-time budget fails.

**Are you testing the website rendering?** The k6 script tests the HTTP product API. It does not run a real browser or measure rendering and interaction timings.

**How do you know you deploy what you tested?** The local pipeline snapshots both source and release configuration before the test and starts that same snapshot in production. The CI workflow saves the tested Docker image and passes it to the deployment job without rebuilding.

**What does Docker add?** It packages the application with its Node runtime into an image. Staging and deployment can then use the same packaged application.

**Where is production?** For the live local demo, it is a separate local process on port 3100. The GitHub workflow's demo deployment is a temporary container on its runner. Neither is a persistent public production service.

**What happens to the old release after a failed test?** It keeps running. The pipeline stops the old release only after the candidate passes and deployment begins.

**Does this provide zero downtime?** No. A successful local deployment briefly restarts the process. A failed gate does not stop the existing process.

**Is the slowdown real?** We intentionally add a delay to model a regression. This gives a repeatable demonstration. It does not claim to diagnose a real database problem.

**Is this comparing versions against a baseline?** No. Every candidate must satisfy the same fixed budgets. Comparing p95 with stored historical results is possible future work.

**Why fifteen seconds?** It makes the live demonstration quick. It is insufficient to establish real system capacity or long-term reliability.

**How would you improve it?** Use a realistic workload and longer tests, add historical comparisons, deploy to a persistent staging environment, and monitor the service after release.

References: [k6 thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) and [k6 threshold failure exit code](https://grafana.com/docs/learning-paths/establish-k6-baseline/validate-thresholds/).
