import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, uuidv4, getAuthenticatedUser } from './common.js';

export const options = {
  scenarios: {
    atm_cardless_flow: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        { duration: '3s', target: 5 },
        { duration: '10s', target: 10 },
        { duration: '2s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  const users = [];
  // Setup 10 distinct users so each VU operates on its own phone number
  for (let i = 1; i <= 10; i++) {
    const u = getAuthenticatedUser(100 + i);
    // Seed initial balance
    const depPayload = JSON.stringify({
      account_id: u.accountId,
      amount: 10000000,
      currency: 'THB',
      deposit_ref: `ATM-INIT-${uuidv4().substring(0, 8)}`,
      description: 'ATM test seed',
    });
    http.post(`${BASE_URL}/transaction/deposit`, depPayload, {
      headers: Object.assign({}, u.authHeaders, { 'Idempotency-Key': uuidv4() }),
    });
    users.push(u);
  }
  return { users };
}

export default function (data) {
  const user = data.users[(__VU - 1) % data.users.length];
  const atmId = (Math.floor(Math.random() * 3) + 1); // ATM 1, 2, or 3
  const amount = 10000; // ฿100.00 in Satang

  // Step 1: Mobile App Request Cardless Ticket
  const reqPayload = JSON.stringify({
    account_id: user.accountId,
    amount: amount,
    atm_id: atmId,
    pin: user.pin,
  });

  const reqRes = http.post(`${BASE_URL}/transaction/withdraw/request`, reqPayload, {
    headers: Object.assign({}, user.authHeaders, { 'Idempotency-Key': uuidv4() }),
  });

  const reqPass = check(reqRes, {
    'request status is 200': (r) => r.status === 200,
  });

  if (!reqPass) {
    sleep(0.1);
    return;
  }

  let code = '';
  try {
    const body = JSON.parse(reqRes.body);
    code = body.code;
  } catch (e) {
    return;
  }

  // Step 2: ATM Machine Touch Screen Verify Code
  const verifyPayload = JSON.stringify({
    phone_number: user.phone,
    code: code,
  });

  const verifyRes = http.post(`${BASE_URL}/transaction/withdraw/verify`, verifyPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const verifyPass = check(verifyRes, {
    'verify status is 200': (r) => r.status === 200,
  });

  if (!verifyPass) {
    sleep(0.1);
    return;
  }

  let orderId = '';
  try {
    const vBody = JSON.parse(verifyRes.body);
    orderId = vBody.order_id;
  } catch (e) {
    return;
  }

  // Step 3: ATM Dispense & Settlement Confirmation
  const confirmPayload = JSON.stringify({
    order_id: orderId,
    phone_number: user.phone,
    code: code,
    atm_id: atmId,
  });

  const confirmRes = http.post(`${BASE_URL}/transaction/withdraw/confirm`, confirmPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(confirmRes, {
    'confirm status is 200': (r) => r.status === 200,
    'confirmed double entry completed': (r) => {
      try {
        const cBody = JSON.parse(r.body);
        return cBody && cBody.status === 'SUCCESS';
      } catch (e) {
        return false;
      }
    },
  });

  sleep(0.1);
}
