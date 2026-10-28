import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { rm } from 'node:fs/promises';
import {
  detectLevelChanges, eruptionCandidate, levelLabel, normalizeCamera, normalizeEruption, normalizeGalleryPhoto,
  normalizeKrb, normalizeLevelChange, normalizeReport, normalizeVona, normalizeVolcanoStatuses, parseVolcanoLevel,
  seismogramsForVolcano, volcanoSlug, vonaCandidate, type LevelObservation,
} from '../src/lib/volcano/magma';
import { normalizeTopics } from '../src/lib/volcano/push';
import { LIST_INITIAL_COUNT, progressiveSlice } from '../src/lib/volcano/paging';
import { loadVapidKeys, saveVapidKeys, withVolcanoLock } from '../src/lib/volcano/store';

/* ----------------------------------------------------- daftar bertahap -- */

// Semua menu gunung api memakai batas 10 entri yang sama. Ini menjaga agar
// daftar 69 gunung api tidak memanjang penuh dan tombol "Muat" selalu muncul
// hanya bila memang masih ada sisa.
test('progressiveSlice menampilkan 10 entri lalu bertambah 10', () => {
  const items = Array.from({ length: 69 }, (_, i) => i);
  assert.equal(LIST_INITIAL_COUNT, 10);

  const first = progressiveSlice(items, LIST_INITIAL_COUNT);
  assert.equal(first.visible.length, 10);
  assert.equal(first.shown, 10);
  assert.equal(first.remaining, 59);
  assert.equal(first.nextCount, 10);
  assert.equal(first.hasMore, true);

  const second = progressiveSlice(items, LIST_INITIAL_COUNT * 2);
  assert.equal(second.visible.length, 20);
  assert.equal(second.remaining, 49);

  // Langkah terakhir tidak boleh meminta lebih dari sisa.
  const last = progressiveSlice(items, 65);
  assert.equal(last.nextCount, 4);
  assert.equal(last.hasMore, true);

  const done = progressiveSlice(items, 69);
  assert.equal(done.hasMore, false);
  assert.equal(done.nextCount, 0);
});

test('progressiveSlice tidak menampilkan tombol untuk daftar pendek atau kosong', () => {
  const short = progressiveSlice([1, 2, 3], LIST_INITIAL_COUNT);
  assert.equal(short.visible.length, 3);
  assert.equal(short.hasMore, false);

  const empty = progressiveSlice<number>([], LIST_INITIAL_COUNT);
  assert.equal(empty.visible.length, 0);
  assert.equal(empty.hasMore, false);
  assert.equal(empty.nextCount, 0);
});

/* ------------------------------------------------------------------ level -- */

test('parseVolcanoLevel membaca angka 1–4 dan label resmi', () => {
  assert.equal(parseVolcanoLevel(1), 1);
  assert.equal(parseVolcanoLevel(4), 4);
  assert.equal(parseVolcanoLevel('3'), 3);
  assert.equal(parseVolcanoLevel(null, 'Level II (Waspada)'), 2);
  assert.equal(parseVolcanoLevel(null, 'Level III (Siaga)'), 3);
  assert.equal(parseVolcanoLevel(null, 'Level IV (Awas)'), 4);
  assert.equal(parseVolcanoLevel(null, 'NORMAL'), 1);
  assert.equal(parseVolcanoLevel(9), null);
  assert.equal(parseVolcanoLevel(null, 'tidak diketahui'), null);
});

test('levelLabel memakai nomenklatur resmi', () => {
  assert.equal(levelLabel(1), 'Level I (Normal)');
  assert.equal(levelLabel(3), 'Level III (Siaga)');
  assert.equal(levelLabel(null), 'Tingkat tidak tercantum');
});

/* --------------------------------------------------------------- status ---- */

const homeMaps = {
  success: true,
  data: {
    volcanoes: [
      {
        id: 'abc', code: 'MER', name: 'Merapi', province: 'DI Yogyakarta', city: 'Boyolali',
        elevation: 2968, latitude: -7.54, longitude: 110.446, status: 3, status_label: 'Level III (Siaga)',
        has_vona: false, has_ven: true,
      },
      // koordinat di luar Indonesia → dilewati, bukan ditebak
      { id: 'x', code: 'BAD', name: 'Tidak Valid', latitude: 45, longitude: 12, status: 2, status_label: 'Level II (Waspada)' },
      // tanpa kode → dilewati
      { id: 'y', name: 'Tanpa Kode', latitude: -7, longitude: 110, status: 1, status_label: 'Level I (Normal)' },
    ],
  },
};

test('normalizeVolcanoStatuses mempertahankan data resmi dan menyaring baris tidak valid', () => {
  const rows = normalizeVolcanoStatuses(homeMaps, '2026-01-01T00:00:00.000Z');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, 'MER');
  assert.equal(rows[0].level, 3);
  assert.equal(rows[0].levelLabel, 'Level III (Siaga)');
  assert.equal(rows[0].hasVen, true);
  assert.equal(rows[0].receivedAt, '2026-01-01T00:00:00.000Z');
});

test('normalizeVolcanoStatuses menerima bentuk array langsung', () => {
  const rows = normalizeVolcanoStatuses({ data: [{ code: 'AGU', name: 'Agung', latitude: -8.342, longitude: 115.508, status: 1 }] }, '2026-01-01T00:00:00.000Z');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, 'AGU');
  assert.equal(rows[0].level, 1);
});

/* ------------------------------------------------------------- laporan ---- */

test('normalizeReport memetakan laporan aktivitas VAR tanpa mengubah teks resmi', () => {
  const report = normalizeReport({
    id: 'r1',
    slug: 'var-merapi-2026-01-01',
    volcano: { id: 'abc', code: 'MER', name: 'Merapi', province: 'DI Yogyakarta' },
    date: '2026-01-01',
    period: '00:00-06:00',
    time_zone: 'WIB',
    status: 'SIAGA',
    user_name: 'Petugas',
    recommendation: { recommendation: 'Tidak melakukan aktivitas di radius 5 km.' },
    visual: {
      other_information: 'Asap putih tipis',
      image: { url: 'https://magma.vsi.esdm.go.id/img/ga/MER/MER202601010000.png' },
    },
    visual_text: 'Gunung jelas.',
    seismic: [{ seismic_name: 'Guguran', data: { jumlah: 12 } }, { seismic_name: 'Vulkanik Dangkal', count: 3 }],
    created_at: '2026-01-01T01:00:00Z',
  }, 'aktivitas', 'https://magma.esdm.go.id');
  assert.ok(report);
  assert.equal(report!.volcanoCode, 'MER');
  assert.equal(report!.level, 3);
  assert.equal(report!.levelLabel, 'Level III (Siaga)');
  assert.equal(report!.recommendation, 'Tidak melakukan aktivitas di radius 5 km.');
  assert.equal(report!.kind, 'aktivitas');
  assert.match(report!.visualImagePath ?? '', /^\/api\/volcano\/image\?url=/);
  assert.equal(report!.seismic.length, 2);
  assert.equal(report!.publishedAt, '2026-01-01T01:00:00.000Z');
});

test('normalizeReport menolak laporan tanpa id atau tanggal yang sah', () => {
  assert.equal(normalizeReport({ volcano: { name: 'X' }, date: '2026-01-01' }, 'aktivitas', ''), null);
  assert.equal(normalizeReport({ id: 'a', volcano: { name: 'X' }, date: 'kemarin' }, 'harian', ''), null);
});

/* --------------------------------------------------------------- letusan -- */

test('normalizeEruption hanya memakai waktu dan parameter resmi VEN', () => {
  const event = normalizeEruption({
    id: 'ven-1',
    volcano: { code: 'SMR', name: 'Semeru', province: 'Jawa Timur' },
    datetime: '2026-01-01T17:00:00Z',
    ash_height: 800,
    duration: 120,
    user_name: 'Pengamat',
    information: 'Erupsi dengan kolom abu 800 m.',
    recommendation: 'Jauhi radius 5 km.',
    zone_area: 'WITA',
    created_at: '2026-01-01T17:05:00Z',
  }, '2026-01-01T17:06:00.000Z');
  assert.ok(event);
  assert.equal(event!.volcanoCode, 'SMR');
  assert.equal(event!.ashHeightM, 800);
  assert.equal(event!.occurredAt, '2026-01-01T17:00:00.000Z');
  assert.equal(event!.receivedAt, '2026-01-01T17:06:00.000Z');
  assert.notEqual(event!.occurredAt, event!.publishedAt);
});

test('normalizeEruption menolak baris tanpa waktu kejadian', () => {
  assert.equal(normalizeEruption({ id: 'x', volcano_name: 'Semeru' }), null);
});

/* ------------------------------------------------------------------ VONA -- */

test('normalizeVona mempertahankan kode warna resmi', () => {
  const notice = normalizeVona({
    id: 'v1', volcano_name: 'Semeru', issued: '2026-01-01T00:00:00Z', previous_code: 'ORANGE',
    current_code: 'RED', ash_height: 1500, type_label: 'Real', is_sent: true,
  });
  assert.ok(notice);
  assert.equal(notice!.previousCode, 'ORANGE');
  assert.equal(notice!.currentCode, 'RED');
  assert.equal(normalizeVona({ id: 'v2', volcano_name: 'X', issued: '2026-01-01T00:00:00Z', current_code: 'UNGKU' })!.currentCode, null);
});

/* ------------------------------------------------------- perubahan level -- */

test('normalizeLevelChange menandai arah dan sumber perubahan', () => {
  const change = normalizeLevelChange({
    volcano_id: 'abc', previous_level: 'WASPADA', current_level: 'SIAGA', change_direction: 'NAIK',
    change_date: '2026-01-02', end_date: null, duration_days: 10, source_name: 'VAR', created_by_name: 'Petugas',
  }, 'MER', 'Merapi');
  assert.ok(change);
  assert.equal(change!.direction, 'NAIK');
  assert.equal(change!.previousLabel, 'Level II (Waspada)');
  assert.equal(change!.currentLabel, 'Level III (Siaga)');
  assert.equal(change!.changeDate, '2026-01-02');
  assert.equal(normalizeLevelChange({ change_date: 'bukan tanggal' }, 'MER', 'Merapi'), null);
});

/* ------------------------------------------------------- CCTV / KRB / foto -- */

test('normalizeCamera memakai gambar snapshot resmi dan bukan video', () => {
  const camera = normalizeCamera({
    id: 'MER:ABC:CCTV:0', volcano_code: 'MER', volcano_name: 'Merapi', station: 'ABC',
    captured_at: '2026-01-01T00:00:00Z', urls: ['https://vsi.esdm.go.id/outpost-hub/visual-images/render/x.jpg'],
  });
  assert.ok(camera);
  assert.match(camera!.imagePath, /^\/api\/volcano\/image\?url=https%3A%2F%2Fvsi\.esdm\.go\.id/);
  assert.equal(normalizeCamera({ id: 'a', volcano_code: 'MER', volcano_name: 'Merapi', urls: ['http://tidak-aman/x.jpg'] }), null);
});

test('normalizeKrb menautkan berkas peta resmi via proxy', () => {
  const map = normalizeKrb({
    id: 'krb-1', volcano_id: 'abc', volcano_name: 'Merapi', year: 2010, file_size: 1_000_000,
    image: { url: 'https://vsi.esdm.go.id/data/api/files/token', original_file_name: 'MER.jpg' },
  });
  assert.ok(map);
  assert.equal(map!.year, '2010');
  assert.equal(map!.fileType, 'JPG');
  assert.equal(map!.imagePath, '/api/volcano/krb/krb-1/file?mode=preview');
  assert.equal(map!.downloadPath, '/api/volcano/krb/krb-1/file?mode=download');
});

test('normalizeGalleryPhoto mengambil tanggal visual dari nama berkas sumber saja', () => {
  const photo = normalizeGalleryPhoto({
    image: { url: 'https://magma.vsi.esdm.go.id/img/ga/MAR/MAR202601012400.png' },
    volcano_name: 'Marapi',
    var_visual_created_at: '2026-01-01T17:30:00Z',
  });
  assert.ok(photo);
  assert.equal(photo!.visualDate, '2026-01-01');
  assert.equal(photo!.volcanoCode, 'MAR');
  assert.equal(photo!.uploadedAt, '2026-01-01T17:30:00.000Z');
});

/* ----------------------------------------------------------- seismogram ---- */

test('seismogramsForVolcano hanya memakai stasiun dengan kode gunung api yang sama', () => {
  const stations = [
    { id: 1, volcanoCode: 'MER', volcanoName: 'Merapi' },
    { id: 2, volcanoCode: '', volcanoName: 'Merapi' },
    { id: 3, volcanoCode: 'SMR', volcanoName: 'Semeru' },
  ].map((s) => ({
    ...s, scnl: `X${s.id}_EHZ_VG_00`, station: `X${s.id}`, channel: 'EHZ', network: 'VG', location: '00',
    hit: 0, imagePath: '', pageUrl: '', sourceImageUrl: '',
  }));
  const refs = seismogramsForVolcano(stations, 'MER', 'Merapi');
  // Stasiun tanpa kode gunung api dicocokkan dengan nama yang sama (bukan ditebak).
  assert.deepEqual(refs.map((r) => r.id), [1, 2]);
});

/* -------------------------------------------------------------- deteksi ---- */

const obs = (code: string, level: LevelObservation['level']): LevelObservation => ({
  code, name: code, level, label: level ? levelLabel(level) : '',
});

test('detectLevelChanges tidak mengirim notifikasi pada pemeriksaan pertama', () => {
  const previous = new Map<string, LevelObservation>();
  const changes = detectLevelChanges(previous, [obs('MER', 3)], '2026-01-01T00:00:00.000Z');
  assert.equal(changes.length, 0);
});

test('detectLevelChanges hanya melaporkan gunung api yang tingkatnya berubah', () => {
  const previous = new Map<string, LevelObservation>([['MER', obs('MER', 2)], ['SMR', obs('SMR', 3)]]);
  const changes = detectLevelChanges(previous, [obs('MER', 3), obs('SMR', 3), obs('AGU', 2)], '2026-01-02T00:00:00.000Z');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].volcanoCode, 'MER');
  assert.equal(changes[0].kind, 'level-change');
  assert.match(changes[0].body, /Level II \(Waspada\).*Level III \(Siaga\)/);
});

test('eruptionCandidate hanya dibuat sekali per informasi letusan (dedupe)', () => {
  const event = normalizeEruption({
    id: 'ven-9', volcano: { code: 'SMR', name: 'Semeru' }, datetime: '2026-01-01T00:00:00Z', information: 'Erupsi.',
  })!;
  const seen = new Set<string>();
  const first = eruptionCandidate(event, seen);
  assert.ok(first);
  assert.equal(first!.kind, 'eruption');
  assert.equal(first!.url, '/gunung-berapi/smr/erupsi');
  seen.add(event.id);
  assert.equal(eruptionCandidate(event, seen), null);
});

test('vonaCandidate menghasilkan satu notifikasi per VONA baru', () => {
  const notice = normalizeVona({ id: 'vona-1', volcano_name: 'Semeru', issued: '2026-01-01T00:00:00Z', current_code: 'ORANGE' })!;
  const candidate = vonaCandidate(notice, new Set());
  assert.ok(candidate);
  assert.equal(candidate!.kind, 'vona');
  assert.equal(vonaCandidate(notice, new Set([notice.id])), null);
});

test('perubahan status tidak pernah diklasifikasikan sebagai erupsi', () => {
  const previous = new Map<string, LevelObservation>([['AGU', obs('AGU', 2)]]);
  const changes = detectLevelChanges(previous, [obs('AGU', 4)], '2026-01-01T00:00:00.000Z');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].kind, 'level-change');
  assert.notEqual(changes[0].kind, 'eruption');
});

/* ------------------------------------------------------------------ slug ---- */

test('volcanoSlug memakai kode resmi huruf kecil untuk URL internal', () => {
  assert.equal(volcanoSlug('MER', 'Merapi'), 'mer');
  assert.equal(volcanoSlug('', 'Anak Krakatau'), 'anak-krakatau');
});

/* ------------------------------------------------------------- topik push -- */

test('normalizeTopics tidak pernah mengaktifkan bawaan saat pembaruan topik', () => {
  // Pembaruan: `false` yang dikirim pengguna harus dihormati, bukan ditimpa bawaan.
  assert.deepEqual(normalizeTopics({ volcano: true, vona: true }, 'off'), {
    volcano: true, levelChange: false, eruption: false, vona: true, recommendation: false,
  });
  assert.deepEqual(normalizeTopics({ volcano: false }, 'off'), {
    volcano: false, levelChange: false, eruption: false, vona: false, recommendation: false,
  });
  // Pembuatan langganan baru tetap memakai bawaan bila kategori tidak dikirim.
  assert.deepEqual(normalizeTopics(undefined, 'default'), {
    volcano: true, levelChange: true, eruption: true, vona: false, recommendation: false,
  });
});

test('normalizeTopics selalu menyisakan minimal satu kategori saat topik aktif', () => {
  const allOff = normalizeTopics({
    volcano: true, levelChange: false, eruption: false, vona: false, recommendation: false,
  }, 'off');
  assert.equal(allOff.volcano, true);
  assert.equal(
    allOff.levelChange || allOff.eruption || allOff.vona || allOff.recommendation,
    true,
    'paling sedikit satu kategori harus aktif bila langganan gunung api aktif',
  );
});

test('normalizeTopics bersifat idempoten untuk nilai yang dikirim balik', () => {
  const first = normalizeTopics({ volcano: true, vona: true, levelChange: false, eruption: false, recommendation: false });
  assert.deepEqual(normalizeTopics(first, 'off'), first);
  assert.deepEqual(normalizeTopics(first, 'default'), first);
});


/* -------------------------------------------- penyimpanan tingkat berkas -- */

// Regresi: pemakaian pertama pada direktori yang belum ada sebelumnya gagal
// ENOENT karena kunci dan berkas VAPID berada di direktori berbeda. Keduanya
// kini membuat direktori induknya sendiri.
test('saveVapidKeys dan withVolcanoLock bekerja saat direktori data belum ada', async () => {
  const dir = path.join(os.tmpdir(), `seismos-volcano-${Date.now()}`);
  process.env.VOLCANO_DATA_DIR = path.join(dir, 'volcano');
  process.env.TSUNAMI_DATA_DIR = path.join(dir, 'tsunami');
  try {
    const keys = { publicKey: 'BPublic'.repeat(10), privateKey: 'Priv'.repeat(12), createdAt: new Date().toISOString() };
    await saveVapidKeys(keys);
    const loaded = await loadVapidKeys();
    assert.equal(loaded?.publicKey, keys.publicKey);

    const value = await withVolcanoLock('probe', async () => 42);
    assert.equal(value, 42);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
