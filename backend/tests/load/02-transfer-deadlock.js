import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, uuidv4, getAuthenticatedUser } from './common.js';

export const options = {
  scenarios: {
    transfer_race_condition: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '3s', target: 15 },
        { duration: '10s', target: 30 },
        { duration: '3s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<600', 'p(99)<1500'], // Accounts for bcrypt CPU cost & container scheduling
    http_req_failed: ['rate<0.02'],
  },
};

export function setup() {
  const users = [];
  // Setup 4 test users with initial balance
  for (let i = 1; i <= 4; i++) {
    const u = getAuthenticatedUser(i);
    // Initial deposit so accounts have plenty of balance for transfers
    const depPayload = JSON.stringify({
      account_id: u.accountId,
      amount: 10000000, // ฿100,000.00 in Satang
      currency: 'THB',
      deposit_ref: `INIT-DEP-${uuidv4().substring(0, 8)}`,
      description: 'k6 test account initialization',
    });
    const depParams = {
      headers: Object.assign({}, u.authHeaders, { 'Idempotency-Key': uuidv4() }),
    };
    http.post(`${BASE_URL}/transaction/deposit`, depPayload, depParams);
    users.push(u);
  }
  return { users };
}

export default function (data) {
  const senderIndex = Math.floor(Math.random() * data.users.length);
  let receiverIndex = Math.floor(Math.random() * data.users.length);
  while (receiverIndex === senderIndex) {
    receiverIndex = Math.floor(Math.random() * data.users.length);
  }

  const sender = data.users[senderIndex];
  const receiver = data.users[receiverIndex];
  const amount = Math.floor(Math.random() * 1000) + 100; // ฿1.00 to ฿10.00
  const idempotencyKey = uuidv4();

  const payload = JSON.stringify({
    sender_account_id: sender.accountId,
    receiver_account_id: receiver.accountId,
    amount: amount,
    currency: 'THB',
    description: `k6 stress transfer from user ${senderIndex + 1} to ${receiverIndex + 1}`,
    pin: sender.pin,
  });

  const params = {
    headers: Object.assign({}, sender.authHeaders, {
      'Idempotency-Key': idempotencyKey,
    }),
  };

  const res = http.post(`${BASE_URL}/transaction/transfer`, payload, params);

  check(res, {
    'transfer status is 200': (r) => r.status === 200,
    'transfer receipt returned': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.status === 'SUCCESS';
      } catch (e) {
        return false;
      }
    },
  });

  sleep(0.05);
}
