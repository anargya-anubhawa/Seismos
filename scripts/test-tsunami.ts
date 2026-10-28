import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isTsunamiInfo, normalizeTsunamiInfo, parseBmkgDateTime, parseCoordinate, parseDatagempaPayload,
  parseIssueTime, parseTsunamiHistoryHtml,
} from '../src/lib/tsunami/parse';
import { decodeNuxtData } from '../src/lib/tsunami/nuxt';
import {
  applyCandidate, classifyChange, createAlert, findMatchingAlert, fingerprintAlert,
} from '../src/lib/tsunami/identity';
import { buildTsunamiFeed } from '../src/lib/tsunami/feed';
import { buildTsunamiPushPayload } from '../src/lib/tsunami/push-payload';
import type { TsunamiAlert, TsunamiSourceStatus } from '../src/types/tsunami';

const baseInfo = (over: Record<string, unknown> = {}) => ({
  event: 'Gempabumi',
  date: '15-08-26',
  time: '04:58:24 WIB',
  point: { coordinates: '121.39,-8.41' },
  latitude: '8.41 LS',
  longitude: '121.39 BT',
  magnitude: '7.7',
  depth: '15 Km',
  area: '30 km TimurLaut MBAY-NAGEKEO-NTT',
  eventid: 20260815073130,
  potential: 'Potensi TSUNAMI untuk diteruskan pada masyarakat',
  subject: 'Warning Tsunami PD-3.4',
  headline: 'Pemutakhiran Peringatan Dini, Tsunami akibat gempa Mag:7.7',
  description: 'Peringatan dini tsunami diperbarui.',
  instruction1: 'Pemerintah daerah status Awas segera mengevakuasi masyarakat.',
  instruction2: 'Pemerintah daerah status Siaga bersiap evakuasi.',
  instruction3: 'Pemerintah daerah status Waspada menjauhi pantai.',
  wzarea: [
    { province: 'NTT', district: 'MANGGARAI BAGIAN UTARA', level: 'WASPADA', date: '15-08-2026', time: '05:02:23 WIB' },
    { province: 'NTT', district: 'MBAY', level: 'AWAS', date: '15-08-2026', time: '05:02:23 WIB' },
    { province: 'NTT', district: 'ENDE', level: 'SIAGA', date: '15-08-2026', time: '05:02:23 WIB' },
  ],
  obsarea: [
    { location: 'BAKALANG-ALOR', loclatitude: -8.26, loclongitude: 124.23, height: 0.14, date: '15-08-2026', time: '05:41 WIB' },
  ],
  timesent: '15/08/2026 07:05:32WIB',
  ...over,
});

test('parse tanggal/jam BMKG menjadi ISO UTC', () => {
  assert.equal(parseBmkgDateTime('15-08-26', '04:58:24 WIB'), '2026-08-14T21:58:24.000Z');
  assert.equal(parseIssueTime('15/08/2026 07:31:30WIB'), '2026-08-15T00:31:30.000Z');
  assert.equal(parseIssueTime('2026-10-28T18:59:15WIB'), '2026-10-28T11:59:15.000Z');
  assert.equal(parseIssueTime('bukan-waktu'), null);
});

test('parse koordinat LS/LU/BT/BB', () => {
  assert.equal(parseCoordinate('8.41 LS'), -8.41);
  assert.equal(parseCoordinate('5.40 LU'), 5.4);
  assert.equal(parseCoordinate('121.39 BT'), 121.39);
  assert.equal(parseCoordinate('104.66 BB'), -104.66);
  assert.equal(parseCoordinate('bukan-koordinat'), null);
});

test('deteksi tsunami tidak salah pada gempa "tidak berpotensi tsunami"', () => {
  assert.equal(isTsunamiInfo(baseInfo()), true);
  assert.equal(isTsunamiInfo({
    subject: 'Warning Gempa dirasakan',
    potential: 'Gempa ini dirasakan untuk diteruskan pada masyarakat',
    headline: 'Info Gempa dirasakan Mag:3.4',
  }), false);
  assert.equal(isTsunamiInfo({
    subject: 'Info Gempa',
    potential: 'Gempa ini tidak berpotensi tsunami',
    headline: 'Gempa M 5.0 tidak berpotensi tsunami',
  }), false);
});

test('normalisasi info tsunami: fase, gempa, wilayah, dan pengamatan', () => {
  const candidate = normalizeTsunamiInfo(baseInfo(), 'history');
  assert.ok(candidate);
  assert.equal(candidate.phase, 'PD-3.4');
  assert.equal(candidate.status, 'active');
  assert.equal(candidate.issueTime, '2026-08-15T00:05:32.000Z');
  assert.equal(candidate.originTime, '2026-08-14T21:58:24.000Z');
  assert.equal(candidate.magnitude, 7.7);
  assert.equal(candidate.depthKm, 15);
  assert.equal(candidate.latitude, -8.41);
  assert.equal(candidate.longitude, 121.39);
  assert.deepEqual(candidate.regions.map((region) => region.level), ['AWAS', 'SIAGA', 'WASPADA']);
  assert.equal(candidate.observations.length, 1);
  assert.equal(candidate.observations[0].heightM, 0.14);
  assert.equal(candidate.source, 'history');
});

test('PD-4 dianggap peringatan berakhir', () => {
  const candidate = normalizeTsunamiInfo(baseInfo({
    subject: 'Warning Tsunami PD-4',
    headline: 'Peringatan Dini TSUNAMI dinyatakan telah berakhir',
    wzarea: [],
    obsarea: [],
  }), 'datagempa');
  assert.ok(candidate);
  assert.equal(candidate.status, 'ended');
  assert.equal(candidate.phase, 'PD-4');
});

test('feed datagempa non-tsunami tidak menghasilkan alert', () => {
  const candidate = parseDatagempaPayload({
    sent: '2026-10-28T18:59:15WIB',
    info: {
      event: 'Gempabumi',
      date: '28-10-26',
      time: '18:59:15 WIB',
      magnitude: '3.4',
      depth: '4 Km',
      area: 'Pusat gempa berada di darat 10 km Utara Tanggamus',
      eventid: 20261028185915,
      subject: 'Warning Gempa dirasakan',
      potential: 'Gempa ini dirasakan untuk diteruskan pada masyarakat',
      headline: 'Info Gempa dirasakan Mag:3.4',
      timesent: '28/10/2026 19:04:15WIB',
    },
  });
  assert.equal(candidate, null);
});

test('decode payload Nuxt menyelesaikan referensi Reactive', () => {
  const payload = [null, { value: 2 }, ['Reactive', 3], 42];
  const html = `<script type="application/json" id="__NUXT_DATA__">${JSON.stringify(payload)}</script>`;
  assert.deepEqual(decodeNuxtData(html), { value: 42 });
});

test('parse halaman riwayat tsunami BMKG dari payload Nuxt', () => {
  const info = baseInfo();
  const html = `<html><script type="application/json" id="__NUXT_DATA__">${JSON.stringify([null, { alert: { info: [info] } }])}</script></html>`;
  const candidates = parseTsunamiHistoryHtml(html);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].source, 'history');
  assert.equal(candidates[0].regions.length, 3);
});

test('identitas stabil saat BMKG merevisi koordinat/magnitudo gempa', () => {
  const pd1 = normalizeTsunamiInfo(baseInfo({
    date: '15-08-26',
    time: '04:58:23 WIB',
    latitude: '8.33 LS',
    longitude: '121.32 BT',
    magnitude: 7,
    subject: 'Warning Tsunami PD-1',
    timesent: '15/08/2026 05:00:37WIB',
    wzarea: [{ province: 'NTT', district: 'MBAY', level: 'WASPADA', date: '15-08-2026', time: '05:00:37 WIB' }],
  }), 'history');
  assert.ok(pd1);
  const alert = createAlert(pd1, '2026-08-15T00:01:00.000Z');

  const pd2 = normalizeTsunamiInfo(baseInfo(), 'history');
  assert.ok(pd2);
  assert.equal(findMatchingAlert([alert], pd2), alert);

  const different = normalizeTsunamiInfo(baseInfo({
    date: '15-08-26',
    time: '06:00:00 WIB',
    latitude: '1.00 LS',
    longitude: '100.00 BT',
    magnitude: 6.2,
    eventid: 20260815130000,
    subject: 'Warning Tsunami PD-1',
    timesent: '15/08/2026 06:05:00WIB',
  }), 'history');
  assert.ok(different);
  assert.equal(findMatchingAlert([alert], different), null);
});

test('pembaruan mempertahankan origin awal dan wilayah saat PD-4 tidak merinci ulang', () => {
  const pd1 = normalizeTsunamiInfo(baseInfo({
    subject: 'Warning Tsunami PD-1',
    timesent: '15/08/2026 05:00:37WIB',
  }), 'history');
  const pd2 = normalizeTsunamiInfo(baseInfo(), 'history');
  assert.ok(pd1 && pd2);
  const created = createAlert(pd1, '2026-08-15T00:01:00.000Z');
  const active = applyCandidate(created, pd2, '2026-08-15T00:10:00.000Z');
  assert.equal(active.changed, true);
  assert.equal(active.alert.phase, 'PD-3.4');
  assert.equal(active.alert.updates.length, 2);
  assert.equal(active.alert.originTime, created.originTime);

  const pd4 = normalizeTsunamiInfo(baseInfo({
    subject: 'Warning Tsunami PD-4',
    headline: 'Peringatan Dini TSUNAMI dinyatakan telah berakhir',
    wzarea: [],
    obsarea: [],
    timesent: '15/08/2026 08:00:00WIB',
  }), 'history');
  assert.ok(pd4);
  const ended = applyCandidate(active.alert, pd4, '2026-08-15T01:00:00.000Z');
  assert.equal(ended.alert.status, 'ended');
  assert.equal(ended.alert.endedAt, pd4.issueTime);
  assert.equal(ended.alert.regions.length, 3);
  assert.equal(ended.alert.regionsIssueTime, pd2.issueTime);
});

test('klasifikasi notifikasi baru/pembaruan/pembatalan', () => {
  const pd1 = normalizeTsunamiInfo(baseInfo({ subject: 'Warning Tsunami PD-1', timesent: '15/08/2026 05:00:37WIB' }), 'history');
  const pd2 = normalizeTsunamiInfo(baseInfo(), 'history');
  assert.ok(pd1 && pd2);
  const active = createAlert(pd1, '2026-08-15T00:01:00.000Z');
  const updated = applyCandidate(active, pd2, '2026-08-15T00:10:00.000Z').alert;
  assert.equal(classifyChange(null, active, false), 'issued');
  assert.equal(classifyChange(active, updated, false), 'updated');
  assert.equal(classifyChange(active, active, false), null);

  const pd4 = normalizeTsunamiInfo(baseInfo({
    subject: 'Warning Tsunami PD-4',
    headline: 'Peringatan Dini TSUNAMI dinyatakan telah berakhir',
    timesent: '15/08/2026 08:00:00WIB',
  }), 'history');
  assert.ok(pd4);
  const ended = applyCandidate(updated, pd4, '2026-08-15T01:00:00.000Z').alert;
  assert.equal(classifyChange(updated, ended, false), 'cancelled');
  assert.equal(classifyChange(ended, ended, false), null);
  assert.equal(fingerprintAlert({ ...active, updatedAt: '2030-01-01T00:00:00.000Z' }), fingerprintAlert(active));
});

test('feed: aktif, tidak ada, dan tidak pasti tidak saling tertukar', () => {
  const now = Date.parse('2026-08-15T01:00:00.000Z');
  const source = (id: 'datagempa' | 'history', fetchedAt: string, ok = true): TsunamiSourceStatus => ({
    id,
    label: id,
    url: 'https://example.test',
    fetchedAt,
    ok,
    stale: false,
    error: ok ? null : 'gagal',
    count: 0,
  });
  const pd1 = normalizeTsunamiInfo(baseInfo({ subject: 'Warning Tsunami PD-1', timesent: '15/08/2026 05:00:37WIB' }), 'history');
  assert.ok(pd1);
  const active = createAlert(pd1, '2026-08-15T00:01:00.000Z');

  const withAlert = buildTsunamiFeed({
    alerts: [active],
    sources: [source('datagempa', '2026-08-15T00:59:00.000Z'), source('history', '2026-08-15T00:00:00.000Z', false)],
    lastCheckAt: '2026-08-15T00:59:00.000Z',
    lastSuccessAt: '2026-08-15T00:59:00.000Z',
    lastHistorySuccessAt: '2026-08-14T23:00:00.000Z',
  }, now);
  assert.equal(withAlert.state, 'active');
  assert.equal(withAlert.stale, true);

  const none = buildTsunamiFeed({
    alerts: [],
    sources: [source('datagempa', '2026-08-15T00:59:00.000Z'), source('history', '2026-08-15T00:58:00.000Z')],
    lastCheckAt: '2026-08-15T00:59:00.000Z',
    lastSuccessAt: '2026-08-15T00:59:00.000Z',
    lastHistorySuccessAt: '2026-08-15T00:58:00.000Z',
  }, now);
  assert.equal(none.state, 'none');
  assert.equal(none.stale, false);

  const unknown = buildTsunamiFeed({
    alerts: [],
    sources: [source('datagempa', '2026-08-15T00:59:00.000Z'), source('history', '2026-08-14T20:00:00.000Z', false)],
    lastCheckAt: '2026-08-15T00:59:00.000Z',
    lastSuccessAt: '2026-08-15T00:59:00.000Z',
    lastHistorySuccessAt: '2026-08-14T20:00:00.000Z',
  }, now);
  assert.equal(unknown.state, 'unknown');
  assert.ok(unknown.message?.includes('tidak dapat dipastikan'));
});

test('payload push memuat judul resmi, status, waktu, wilayah, ringkasan, dan tautan detail', () => {
  const pd1 = normalizeTsunamiInfo(baseInfo(), 'history');
  assert.ok(pd1);
  const alert: TsunamiAlert = createAlert(pd1, '2026-08-15T00:01:00.000Z');
  const payload = buildTsunamiPushPayload(alert, 'issued');
  assert.equal(payload.title, alert.subject);
  assert.match(payload.body, /Status: AKTIF/);
  assert.match(payload.body, /Wilayah:/);
  assert.match(payload.body, /NTT/);
  assert.equal(payload.url, `/tsunami/${alert.id}`);
  assert.equal(payload.tag, `seismos-tsunami-${alert.id}`);
  assert.equal(payload.requireInteraction, true);

  const ended: TsunamiAlert = { ...alert, status: 'ended', endedAt: alert.issueTime };
  const cancelled = buildTsunamiPushPayload(ended, 'cancelled');
  assert.match(cancelled.body, /Status: BERAKHIR/);
  assert.equal(cancelled.requireInteraction, false);
});
