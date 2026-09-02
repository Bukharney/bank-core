import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, uuidv4, getAuthenticatedUser } from './common.js';

export const options = {
  scenarios: {
    concurrent_deposits: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { duration: '3s', target: 30 },  // Warm up
        { duration: '10s', target: 100 }, // Surge to 100 req/s
        { duration: '5s', target: 100 },  // Sustain
        { duration: '2s', target: 0 },   // Cool down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<100', 'p(99)<250'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const users = [];
  for (let i = 1; i <= 5; i++) {
    users.push(getAuthenticatedUser(i));
  }
  return { users };
}

export default function (data) {
  const user = data.users[Math.floor(Math.random() * data.users.length)];
  const amount = Math.floor(Math.random() * 50000) + 1000; // ฿10.00 to ฿500.00
  const idempotencyKey = uuidv4();

  const payload = JSON.stringify({
    account_id: user.accountId,
    amount: amount,
    currency: 'THB',
    deposit_ref: `K6-DEP-${uuidv4().substring(0, 8)}`,
    description: 'k6 high-concurrency automated deposit',
  });

  const params = {
    headers: Object.assign({}, user.authHeaders, {
      'Idempotency-Key': idempotencyKey,
    }),
  };

  const res = http.post(`${BASE_URL}/transaction/deposit`, payload, params);

  check(res, {
    'deposit status is 200': (r) => r.status === 200,
    'has receipt journal id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && (body.journal_id || body.reference_id || body.status === 'SUCCESS');
      } catch (e) {
        return false;
      }
    },
  });

  sleep(0.05);
}
