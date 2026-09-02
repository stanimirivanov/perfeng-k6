import { check, sleep } from 'k6';
import http from 'k6/http';
import { generateRandomId, getApiUrl, getHeaders, THINK_TIME } from '../../lib/config.js';
import {
  accountOperationDuration,
  transactionErrorRate,
} from '../../lib/metrics.js';

export default function () {
  const headers = getHeaders();
  const userId = generateRandomId('user');

  // Get user profile
  const startTime = Date.now();
  const profileResponse = http.get(getApiUrl(`/users/${userId}`), { headers });
  const profileLoaded = check(profileResponse, {
    'profile loaded': (r) => r.status === 200 || r.status === 404,
  });

  // Update user preferences
  const updateResponse = http.put(
      getApiUrl(`/users/${userId}/preferences`),
      JSON.stringify({ theme: 'dark', language: 'en' }),
      { headers },
  );
  const preferencesUpdated = check(updateResponse, { 'preferences updated': (r) => r.status === 200 });

  accountOperationDuration.add(Date.now() - startTime);
  transactionErrorRate.add(!(profileLoaded && preferencesUpdated));

  sleep(THINK_TIME);
}
