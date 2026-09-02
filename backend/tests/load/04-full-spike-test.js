import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, uuidv4, getAuthenticatedUser } from './common.js';

export const options = {
  stages: [
    { duration: '3s', target: 10 },  // Normal load
    { duration: '8s', target: 25 },  // Spike
    { duration: '5s', target: 25 },  // Sustain
    { duration: '2s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<800'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  const users = [];
  // Initialize 15 users with ample balance
  for (let i = 1; i <= 15; i++) {
    const u = getAuthenticatedUser(200 + i);
    const depPayload = JSON.stringify({
      account_id: u.accountId,
      amount: 10000000, // ฿100,000.00
      currency: 'THB',
      deposit_ref: `SPIKE-INIT-${uuidv4().substring(0, 8)}`,
      description: 'Spike test seed',
    });
    http.post(`${BASE_URL}/transaction/deposit`, depPayload, {
      headers: Object.assign({}, u.authHeaders, { 'Idempotency-Key': uuidv4() }),
    });
    users.push(u);
  }
  return { users };
}

export default function (data) {
  const action = Math.random();
  const senderIndex = (__VU - 1) % data.users.length;
  const userA = data.users[senderIndex];
  let receiverIndex = (senderIndex + 1) % data.users.length;
  const userB = data.users[receiverIndex];

  if (action < 0.35) {
    // 35% Deposits
    const payload = JSON.stringify({
      account_id: userA.accountId,
      amount: Math.floor(Math.random() * 20000) + 500,
      currency: 'THB',
      deposit_ref: `SPK-DEP-${uuidv4().substring(0, 8)}`,
      description: 'Spike load deposit',
    });
    const res = http.post(`${BASE_URL}/transaction/deposit`, payload, {
      headers: Object.assign({}, userA.authHeaders, { 'Idempotency-Key': uuidv4() }),
    });
    check(res, { 'deposit 200': (r) => r.status === 200 });
  } else if (action < 0.70) {
    // 35% Transfers
    const payload = JSON.stringify({
      sender_account_id: userA.accountId,
      receiver_account_id: userB.accountId,
      amount: Math.floor(Math.random() * 500) + 50,
      currency: 'THB',
      description: 'Spike transfer',
      pin: userA.pin,
    });
    const res = http.post(`${BASE_URL}/transaction/transfer`, payload, {
      headers: Object.assign({}, userA.authHeaders, { 'Idempotency-Key': uuidv4() }),
    });
    check(res, { 'transfer 200': (r) => r.status === 200 });
  } else {
    // 30% Statement / Ledger Reads
    const res = http.get(`${BASE_URL}/ledger/statement/${userA.accountId}?page=1&limit=20`, {
      headers: userA.authHeaders,
    });
    check(res, { 'statement read 200': (r) => r.status === 200 });
  }

  sleep(0.05);
}
