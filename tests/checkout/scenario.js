import { check, sleep } from 'k6';
import http from 'k6/http';
import { getApiUrl, getHeaders, THINK_TIME } from '../../lib/config.js';
import {
  checkoutDuration,
  failedTransactions,
  successfulTransactions,
  transactionErrorRate,
} from '../../lib/metrics.js';

function hasOrderId(response) {
  try {
    return typeof response.json('orderId') === 'string' && response.json('orderId').length > 0;
  } catch {
    return false;
  }
}

export default function () {
  const startTime = Date.now();
  const headers = getHeaders();

  // Step 1: Get cart
  const cartResponse = http.get(getApiUrl('/cart'), { headers });
  const cartLoaded = check(cartResponse, {
    'cart loaded': (r) => r.status === 200,
  });

  // Step 2: Initiate checkout
  const checkoutData = JSON.stringify({
    cartId: 'example-cart',
    paymentMethod: 'credit-card',
    shippingAddress: {
      street: '123 Test St',
      city: 'Test City',
      country: 'US',
    },
  });

  const checkoutResponse = http.post(getApiUrl('/checkout'), checkoutData, {
    headers,
  });

  const checkoutSuccess = check(checkoutResponse, {
    'checkout successful': (r) => r.status === 201 || r.status === 200,
    'checkout response has orderId': (r) => hasOrderId(r),
  });

  // Record metrics
  const duration = Date.now() - startTime;
  checkoutDuration.add(duration);

  if (cartLoaded && checkoutSuccess) {
    successfulTransactions.add(1);
    transactionErrorRate.add(false);
  } else {
    failedTransactions.add(1);
    transactionErrorRate.add(true);
  }

  sleep(THINK_TIME);
}
