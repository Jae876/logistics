import { setTimeout as delay } from 'node:timers/promises';

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3001';
const TRACKING_ID = process.env.TRACKING_ID || 'DGS-100001';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'jameslevinn';

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload;
};

const main = async () => {
  const health = await fetchJson(`${API_BASE}/api/health`);
  const publicRecord = await fetchJson(`${API_BASE}/api/public/shipments?id=${encodeURIComponent(TRACKING_ID)}`);
  const login = await fetchJson(`${API_BASE}/api/login`, {
    method: 'POST',
    body: JSON.stringify({ user: ADMIN_USER, pass: ADMIN_PASS })
  });

  const adminHeaders = {
    'x-admin-token': login.token,
    Authorization: `Bearer ${login.token}`
  };

  const adminList = await fetchJson(`${API_BASE}/api/admin/shipments`, {
    headers: adminHeaders,
    method: 'GET'
  });

  const found = Array.isArray(publicRecord)
    ? publicRecord.find((item) => item.id === TRACKING_ID)
    : publicRecord;

  const adminMatch = Array.isArray(adminList)
    ? adminList.find((item) => item.id === TRACKING_ID)
    : adminList;

  if (!found || !adminMatch) {
    throw new Error('Seeded shipment record was not returned by the serverless public/admin routes.');
  }

  console.log(JSON.stringify({
    health,
    trackingId: TRACKING_ID,
    publicRecord: found,
    adminRecord: adminMatch,
    ok: true
  }, null, 2));
};

try {
  await delay(500);
  await main();
} catch (error) {
  console.error(error?.message || error);
  process.exitCode = 1;
}
