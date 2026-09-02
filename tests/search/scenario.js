import { check, sleep } from 'k6';
import http from 'k6/http';
import { getApiUrl, getHeaders, THINK_TIME } from '../../lib/config.js';
import { searchDuration, transactionErrorRate } from '../../lib/metrics.js';

export default function () {
  const startTime = Date.now();
  const headers = getHeaders();

  const searchQuery = `test-query-${Math.floor(Math.random() * 100)}`;
  const searchResponse = http.get(getApiUrl(`/search?q=${searchQuery}`), {
    headers,
  });

  const searchSuccess = check(searchResponse, {
    'search successful': (r) => r.status === 200,
  });

  const duration = Date.now() - startTime;
  searchDuration.add(duration);
  transactionErrorRate.add(!searchSuccess);

  sleep(THINK_TIME);
}
