# Verified local demo results

These are actual measurements from the local rehearsal on 13 October 2026. Each run used k6 2.3.0, 10 virtual users and a 15-second workload against the product API.

| Release | p95 response time | HTTP failure rate | Response checks | Requests | Gate | Deployment |
|---|---:|---:|---:|---:|---|---|
| v1-fast | 47.75 ms | 0% | 100% pass | 635 | PASS | Deployed |
| v2-slow | 1218.86 ms | 0% | 100% pass | 110 | FAIL | Skipped |
| v3-fixed | 46.58 ms | 0% | 100% pass | 634 | PASS | Deployed |

After v2-slow failed, the production API still returned v1-fast with the same instance identifier as before the test. Its product endpoint continued returning HTTP 200 and four products. After the corrected release passed, production returned v3-fixed with a new instance identifier.

The request counts differ because each virtual user waits for its response before issuing another request. A slow API completes fewer requests in the same duration.

Raw reports and the before/after release identities are in `docs/evidence/`. Your next live run will produce new measurements. Do not present these recorded values as the results of a later run.

Verified: real local k6 execution, thresholds, skipped deployment, preservation of the previous release, successful release replacement, and saved reports.

Prepared but not executed: Docker route and GitHub Actions workflow. Automated browser inspection was blocked by browser security policy. Use a manual browser check for the visible catalogue and history.
