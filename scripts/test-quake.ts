// Harus paling awal: memetakan alias `@/` agar modul beralias dapat diimpor sucrase.
import './test-alias';
import assert from 'node:assert/strict';
import test from 'node:test';
import { isSignificantEarthquake, ALERT_MIN_MAGNITUDE } from '../src/lib/alerts';
import { matchesQuakeRule, validateQuakeRule, DEFAULT_QUAKE_RULE, type QuakeRule } from '../src/lib/quake/rule';
import {
  fingerprintQuake, findKnownQuake, quakeNotificationKey, hash, distanceKm,
  type NotifiedQuake,
} from '../src/lib/quake/identity';
import { buildQuakePayload, devicesFor } from '../src/lib/quake/monitor';
import { provinceForPoint } from '../src/lib/provinces';
import type { Earthquake } from '../src/types/earthquake';

const quake = (over: Partial<Earthquake> = {}): Earthquake => ({
  id: 'k',
  originTime: '2026-10-29T03:26:49Z',
  latitude: -5.45,
  longitude: 141.9,
  magnitude: 6.0,
  depthKm: 120,
  region: 'Pusat gempa berada di darat 153 km tenggara Oksibil',
  sources: ['terbaru'],
  ...over,
});

// ---------- Aturan penting: HARUS memakai fungsi web yang sama ----------

test('scope important memakai isSignificantEarthquake apa adanya', () => {
  const cases = [
    { magnitude: 6.1, feltReports: [], maxMmi: undefined },
    { magnitude: 3.0, feltReports: [{ mmiMin: 2, mmiMax: 3, mmiLabel: 'II', place: 'X' }], maxMmi: 3 },
    { magnitude: 3.0, feltReports: [], maxMmi: 2 },
    { magnitude: 4.9, feltReports: [], maxMmi: undefined },
    { magnitude: 5.0, feltReports: [], maxMmi: undefined },
    { magnitude: 0, feltReports: [], maxMmi: 0 },
  ];
  for (const c of cases) {
    const expected = isSignificantEarthquake({
      magnitude: c.magnitude,
      feltReports: c.feltReports,
      maxMmi: c.maxMmi,
    });
    const event = quake({
      magnitude: c.magnitude,
      feltReports: c.feltReports,
      maxMmi: c.maxMmi,
      latitude: 0,
      longitude: 100,
    });
    assert.equal(
      matchesQuakeRule({ ...DEFAULT_QUAKE_RULE }, event),
      expected,
      `mag=${c.magnitude} felt=${c.feltReports.length} mmi=${c.maxMmi}`,
    );
  }
});

test('ambang magnitudo tetap 5 dan tidak dapat diubah lewat pengaturan', () => {
  assert.equal(ALERT_MIN_MAGNITUDE, 5);
  const parsed = validateQuakeRule({ minMagnitude: 4 });
  assert.equal(parsed.error, null, 'field tak dikenal diabaikan, bukan mengubah ambang');
  // M4,9 tanpa laporan tetap tidak signifikan → tidak dikirim pada mode important.
  assert.equal(
    matchesQuakeRule(parsed.rule!, quake({ magnitude: 4.9, latitude: 0, longitude: 100 })),
    false,
  );
});

test('gempa M4,2 yang dirasakan TETAP dikirim (bukan hanya magnitudo)', () => {
  assert.equal(
    matchesQuakeRule(DEFAULT_QUAKE_RULE, quake({
      magnitude: 4.2,
      feltReports: [{ mmiMin: 2, mmiMax: 3, mmiLabel: 'II', place: 'Kota' }],
      maxMmi: 3,
    })),
    true,
  );
});

test('scope all mengirim gempa kecil sekalipun', () => {
  const rule: QuakeRule = { ...DEFAULT_QUAKE_RULE, scope: 'all' };
  assert.equal(
    matchesQuakeRule(rule, quake({ magnitude: 2.9, feltReports: [], maxMmi: undefined })),
    true,
  );
});

// ---------- Area ----------

test('area provinsi memakai provinsi terdekat, sama dengan web', () => {
  // Bengkulu: pusat -3.7, 102.3.
  const rule: QuakeRule = { ...DEFAULT_QUAKE_RULE, area: 'province', provinceId: 'bengkulu', scope: 'all' };
  const inside = quake({ latitude: -3.8, longitude: 102.2, magnitude: 3 });
  const outside = quake({ latitude: -6.2, longitude: 106.85, magnitude: 3 }); // Jakarta
  assert.equal(provinceForPoint(inside.latitude, inside.longitude).id, 'bengkulu');
  assert.equal(matchesQuakeRule(rule, inside), true);
  assert.equal(matchesQuakeRule(rule, outside), false);
});

test('area provinsi tanpa provinsi terpilih tidak mengirim apa pun', () => {
  const rule: QuakeRule = { ...DEFAULT_QUAKE_RULE, area: 'province', provinceId: null, scope: 'all' };
  assert.equal(matchesQuakeRule(rule, quake()), false);
});

test('area radius memakai jarak haversine yang sama dengan app', () => {
  const rule: QuakeRule = {
    ...DEFAULT_QUAKE_RULE,
    area: 'radius',
    scope: 'all',
    centerLat: -6.2,
    centerLon: 106.85,
    radiusKm: 100,
  };
  const near = quake({ latitude: -6.3, longitude: 106.9, magnitude: 3 });
  const far = quake({ latitude: -8.4, longitude: 115.2, magnitude: 3 }); // Bali
  assert.equal(matchesQuakeRule(rule, near), true);
  assert.equal(matchesQuakeRule(rule, far), false);
  // Jarak yang sama persis dengan perhitungan app (radius 6371 km).
  const d = distanceKm(-6.2, 106.85, -8.4, 115.2);
  assert.ok(d > 800 && d < 1000, `jarak Jakarta-Bali wajar, dapat ${d}`);
});

test('radius di luar 10-500 km ditolak', () => {
  assert.notEqual(validateQuakeRule({ area: 'radius', radiusKm: 5, centerLat: 0, centerLon: 0 }).error, null);
  assert.notEqual(validateQuakeRule({ area: 'radius', radiusKm: 900, centerLat: 0, centerLon: 0 }).error, null);
  assert.equal(validateQuakeRule({ area: 'radius', radiusKm: 50, centerLat: 0, centerLon: 0 }).error, null);
});

test('mode radius tanpa titik pusat ditolak agar tidak diam-diam tidak pernah mengirim', () => {
  assert.notEqual(validateQuakeRule({ area: 'radius', radiusKm: 50 }).error, null);
});

test('provinsi tak dikenal ditolak', () => {
  assert.notEqual(validateQuakeRule({ area: 'province', provinceId: 'atlantis' }).error, null);
});

// ---------- Dedupe ----------

test('sidik jari mengabaikan perbedaan yang tidak mengubah pesan', () => {
  const a = quake();
  const b = quake({ sources: ['terbaru', 'live'], shakemapFile: 'x.jpg' });
  assert.equal(fingerprintQuake(a), fingerprintQuake(b));
});

test('sidik jari berubah saat magnitudo dikoreksi', () => {
  assert.notEqual(fingerprintQuake(quake()), fingerprintQuake(quake({ magnitude: 6.2 })));
});

test('koreksi koordinat 1 km tetap dianggap gempa yang sama', () => {
  const known: NotifiedQuake[] = [{
    key: quakeNotificationKey(quake()),
    originTime: '2026-10-29T03:26:49Z',
    latitude: -5.45,
    longitude: 141.9,
    magnitude: 6.0,
    fingerprint: fingerprintQuake(quake()),
    decidedAt: '2026-10-29T03:27:00Z',
  }];
  // BMKG menggeser pusat ~0,01 derajat dan waktu 40 detik.
  const corrected = quake({ latitude: -5.46, longitude: 141.91, originTime: '2026-10-29T03:27:29Z' });
  const match = findKnownQuake(known, corrected);
  assert.ok(match, 'koreksi kecil harus dikenali sebagai kejadian yang sama');
});

test('gempa susulan 200 km kemudian adalah kejadian BARU', () => {
  const known: NotifiedQuake[] = [{
    key: 'a',
    originTime: '2026-10-29T03:26:49Z',
    latitude: -5.45,
    longitude: 141.9,
    magnitude: 6.0,
    fingerprint: 'x',
    decidedAt: '2026-10-29T03:27:00Z',
  }];
  const aftershock = quake({ latitude: -7.0, longitude: 143.5, magnitude: 5.4 });
  assert.equal(findKnownQuake(known, aftershock), null);
});

test('gempa 20 menit kemudian di lokasi sama adalah kejadian BARU', () => {
  const known: NotifiedQuake[] = [{
    key: 'a',
    originTime: '2026-10-29T03:26:49Z',
    latitude: -5.45,
    longitude: 141.9,
    magnitude: 6.0,
    fingerprint: 'x',
    decidedAt: '2026-10-29T03:27:00Z',
  }];
  assert.equal(
    findKnownQuake(known, quake({ originTime: '2026-10-29T03:46:49Z' })),
    null,
  );
});

test('hash FNV-1a deterministik dan pendek (base36)', () => {
  // Salinan algoritma dari src/lib/tsunami/identity.ts. Sifat yang diuji adalah yang
  // dipakai sebagai identitas: deterministik, pendek, dan berbeda untuk input berbeda.
  assert.equal(hash('abc'), hash('abc'));
  assert.notEqual(hash('abc'), hash('abd'));
  assert.ok(hash('anything').length <= 7, 'hash base36 32-bit muat dalam 7 karakter');
  assert.match(hash('x'), /^[0-9a-z]+$/);
});

// ---------- Payload FCM ----------

test('payload data-only berisi string semua (batasan FCM)', () => {
  const payload = buildQuakePayload(quake(), true);
  for (const [key, value] of Object.entries(payload)) {
    assert.equal(typeof value, 'string', `nilai ${key} harus string`);
  }
  assert.equal(payload.kind, 'earthquake');
  assert.equal(payload.eventId, 'k');
  assert.equal(payload.magnitude, '6.0');
  assert.equal(payload.depthKm, '120');
  assert.equal(payload.severity, 'important');
  assert.equal(payload.channelId, 'seismos_earthquake_important');
  assert.equal(payload.lat, '-5.450');
  assert.equal(payload.lon, '141.900');
  // Tanpa kredensial/token apa pun.
  assert.ok(!JSON.stringify(payload).includes('token'));
});

test('payload tidak memuat field opsional kosong', () => {
  const payload = buildQuakePayload(quake({ felt: undefined, maxMmi: undefined, tsunamiNote: undefined }), false);
  assert.equal('felt' in payload, false);
  assert.equal('maxMmi' in payload, false);
  assert.equal('tsunamiNote' in payload, false);
  assert.equal(payload.severity, 'minor');
});

test('gempa non-penting memakai channel info, bukan alarm', () => {
  const payload = buildQuakePayload(quake({ magnitude: 3.1 }), false);
  assert.equal(payload.channelId, 'seismos_earthquake_info');
});

// ---------- Pemilihan perangkat ----------

const device = (over: Record<string, unknown> = {}) => ({
  deviceId: 'd1',
  fcmToken: 'tok-123456789012345678901234567890',
  platform: 'android' as const,
  appVersion: '1.0.0',
  locale: 'id-ID',
  createdAt: '2026-10-29T00:00:00Z',
  updatedAt: '2026-10-29T00:00:00Z',
  revokedAt: null,
  quake: { ...DEFAULT_QUAKE_RULE },
  quakeEnabled: true,
  quietHours: { enabled: false, startLocal: '22:00', endLocal: '06:00' },
  lastNotifiedKey: null,
  lastNotifiedFingerprint: null,
  lastNotifiedAt: null,
  ...over,
});

test('perangkat yang dimatikan notifikasinya tidak dikirimi', () => {
  assert.equal(devicesFor([device({ quakeEnabled: false })], quake()).length, 0);
});

test('perangkat dengan token dicabut tidak dikirimi', () => {
  assert.equal(devicesFor([device({ revokedAt: '2026-10-29T01:00:00Z' })], quake()).length, 0);
});

test('hanya perangkat yang cocok area yang dikirimi', () => {
  const jakarta = device({
    deviceId: 'd-jkt',
    quake: { ...DEFAULT_QUAKE_RULE, area: 'province', provinceId: 'dki-jakarta', scope: 'all' },
  });
  // 2026-10-29 M6,0 Oksibil: provinsi terdekat menurut `provinceForPoint` adalah
  // Papua Selatan (titik pusat -7.5/139.5), bukan Papua (-4.5/138.5). Diuji langsung
  // agar angka di sini tidak ditebak.
  const papuaSelatan = device({
    deviceId: 'd-papua-selatan',
    quake: { ...DEFAULT_QUAKE_RULE, area: 'province', provinceId: 'papua-selatan', scope: 'all' },
  });
  const event = quake({ latitude: -5.45, longitude: 141.9 });
  assert.equal(provinceForPoint(event.latitude, event.longitude).id, 'papua-selatan');

  const targets = devicesFor([jakarta, papuaSelatan], event);
  assert.deepEqual(targets.map((d) => d.deviceId), ['d-papua-selatan']);
});
