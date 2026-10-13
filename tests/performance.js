import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3001';
// These are fixed acceptance budgets, not a comparison against an old baseline.
export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '15s',
  thresholds: {
    'http_req_duration{endpoint:products}': ['p(95)<500'],
    'http_req_failed{endpoint:products}': ['rate<0.01'],
    checks: ['rate==1'],
    http_reqs: ['count>0'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/api/products`, { tags: { endpoint: 'products' }, timeout: '5s' });
  let body;
  try { body = response.json(); } catch { body = null; }
  check(response, {
    'HTTP status is 200': r => r.status === 200,
    'catalogue contains four products': () => Array.isArray(body?.products) && body.products.length === 4,
    'response is from candidate release': () => !__ENV.EXPECTED_VERSION || body?.version === __ENV.EXPECTED_VERSION,
  });
  sleep(0.2);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  const duration = metrics['http_req_duration{endpoint:products}'];
  const failure = metrics['http_req_failed{endpoint:products}'];
  const report = {
    p95Ms: duration?.values['p(95)'] ?? null,
    failureRate: failure?.values.rate ?? null,
    checksRate: metrics.checks?.values.rate ?? null,
    requests: metrics.http_reqs?.values.count ?? 0,
    thresholds: Object.fromEntries(Object.entries(metrics).filter(([, m]) => m.thresholds)
      .map(([name, metric]) => [name, metric.thresholds])),
    raw: data,
  };
  const passed = Object.values(report.thresholds).every(group => Object.values(group).every(t => t.ok));
  const output = `\nk6 result: ${passed ? 'PASS' : 'FAIL'}\n` +
    `p95: ${report.p95Ms?.toFixed(2)} ms (budget < 500 ms)\n` +
    `HTTP failure rate: ${((report.failureRate ?? 0) * 100).toFixed(2)}% (budget < 1%)\n` +
    `Checks passed: ${((report.checksRate ?? 0) * 100).toFixed(2)}%\n` +
    `Requests: ${report.requests}\n`;
  return { stdout: output, [__ENV.K6_REPORT || 'reports/k6-summary.json']: JSON.stringify(report, null, 2) };
}
