import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:8080';

// Generate RFC4122 v4 UUID
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Ensure a user is registered and logged in, returning auth headers, cookie jar, and account ID
export function getAuthenticatedUser(userNum = 1) {
  const username = `k6_user_${userNum}`;
  const email = `k6_user_${userNum}@bank.test`;
  const password = 'Password123!';
  const phone = `08${String(10000000 + userNum).slice(-8)}`;
  const pin = '123456';

  const headers = { 'Content-Type': 'application/json' };

  // 1. Try Login first
  const loginPayload = JSON.stringify({
    email: email,
    password: password,
  });

  let loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers });

  // 2. If user doesn't exist (400/401/404), register and log in
  if (loginRes.status !== 200) {
    const regPayload = JSON.stringify({
      username: username,
      email: email,
      password: password,
      confirm_password: password,
      first_name: `K6Tester${userNum}`,
      last_name: 'Benchmark',
      phone_number: phone,
    });
    http.post(`${BASE_URL}/user/register`, regPayload, { headers });
    loginRes = http.post(`${BASE_URL}/auth/login`, loginPayload, { headers });
  }

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
  });

  // Extract access_token cookie
  let token = '';
  if (loginRes.cookies && loginRes.cookies.access_token && loginRes.cookies.access_token.length > 0) {
    token = loginRes.cookies.access_token[0].value;
  }
  if (!token) {
    try {
      const data = JSON.parse(loginRes.body);
      token = data.access_token || '';
    } catch (e) {
      // ignore
    }
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': `access_token=${token}`,
  };

  // 3. Set Transaction PIN (if not already set)
  const pinPayload = JSON.stringify({
    password: password,
    pin: pin,
    confirm_pin: pin,
  });
  http.post(`${BASE_URL}/user/pin`, pinPayload, { headers: authHeaders });

  // 4. Get Accounts
  const accRes = http.get(`${BASE_URL}/account`, { headers: authHeaders });
  let accountId = 0;
  if (accRes.status === 200) {
    try {
      const data = JSON.parse(accRes.body);
      const accounts = Array.isArray(data) ? data : data.data || [];
      if (accounts.length > 0) {
        accountId = accounts[0].id;
      }
    } catch (e) {
      // Fallback
    }
  }

  return {
    username,
    email,
    phone,
    pin,
    token,
    authHeaders,
    accountId,
  };
}
