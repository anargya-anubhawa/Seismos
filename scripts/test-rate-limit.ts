import assert from 'node:assert/strict';
import test from 'node:test';
import { clientKey, rateLimit, resetRateLimits } from '../src/lib/rate-limit';

/* ------------------------------------------------------------- rate-limit -- */

const req = (headers: Record<string, string> = {}): Request =>
  new Request('http://localhost/api/probe', { method: 'POST', headers });

test('permintaan di bawah batas diloloskan, yang melewati batas ditolak 429', () => {
  resetRateLimits();
  const options = { name: 'probe', limit: 3, windowMs: 60_000 };
  for (let i = 0; i < 3; i++) {
    assert.equal(rateLimit(req(), options), null, `permintaan ke-${i + 1} harus lolos`);
  }
  const blocked = rateLimit(req(), options);
  assert.ok(blocked, 'permintaan ke-4 harus ditolak');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('Cache-Control'), 'no-store, max-age=0');
  // Retry-After wajib ada supaya klien tahu kapan boleh mencoba lagi.
  const retryAfter = Number(blocked.headers.get('Retry-After'));
  assert.ok(Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 60, `Retry-After tidak masuk akal: ${retryAfter}`);
});

test('nama pembatas berbeda punya jatah terpisah', () => {
  resetRateLimits();
  const a = { name: 'satu', limit: 1, windowMs: 60_000 };
  const b = { name: 'dua', limit: 1, windowMs: 60_000 };
  assert.equal(rateLimit(req(), a), null);
  assert.ok(rateLimit(req(), a));
  // Pembatas lain tetap boleh menerima permintaan.
  assert.equal(rateLimit(req(), b), null);
});

test('jendela waktu yang sudah lewat mengembalikan jatah', () => {
  resetRateLimits();
  const options = { name: 'jendela', limit: 1, windowMs: 1 };
  assert.equal(rateLimit(req(), options), null);
  // Tunggu jendela 1 ms benar-benar lewat sebelum mencoba lagi.
  const until = Date.now() + 10;
  while (Date.now() < until) { /* sibuk tunggu singkat, sesuai jendela */ }
  assert.equal(rateLimit(req(), options), null);
});

test('header x-forwarded-for hanya dipercaya bila TRUST_PROXY_HEADERS=1', () => {
  const spoofed = req({ 'x-forwarded-for': '203.0.113.9' });
  delete process.env.TRUST_PROXY_HEADERS;
  assert.equal(clientKey(spoofed), 'anon', 'tanpa kepercayaan proxy, semua klien jadi satu kunci');

  process.env.TRUST_PROXY_HEADERS = '1';
  try {
    assert.equal(clientKey(spoofed), '203.0.113.9');
    // Hanya entri pertama yang dipakai; sisanya bisa diisi klien.
    assert.equal(clientKey(req({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' })), '198.51.100.1');
    assert.equal(clientKey(req({ 'x-real-ip': '198.51.100.7' })), '198.51.100.7');
    assert.equal(clientKey(req()), 'anon');
  } finally {
    delete process.env.TRUST_PROXY_HEADERS;
  }
});
