import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SATELLITE_PRODUCTS, dayLabel, dateLabel, distanceKm, groupByLocalDate, isInIndonesia, isSignificantWeather,
  nearestArea, normalizeWeatherAlert, normalizeWeatherPoint, parseRssItems, zoneFromOffset,
} from '../src/lib/weather/parse';
import { weatherAlertText, weatherForecastText, SOURCE_BMKG_WEATHER } from '../src/lib/share/report-text';
import type { WeatherAlert, WeatherArea, WeatherForecast, WeatherPoint } from '../src/types/weather';

/* --------------------------------------------------------------- wilayah -- */

const AREAS: WeatherArea[] = [
  { code: '31.71.01.1003', village: 'Gambir', district: 'Gambir', regency: 'Kota Adm. Jakarta Pusat', province: 'DKI Jakarta', latitude: -6.1653, longitude: 106.8153 },
  { code: '32.73.11.1001', village: 'Braga', district: 'Sumur Bandung', regency: 'Kota Bandung', province: 'Jawa Barat', latitude: -6.9175, longitude: 107.6098 },
  { code: '51.71.02.1001', village: 'Kesiman', district: 'Denpasar Timur', regency: 'Kota Denpasar', province: 'Bali', latitude: -8.65, longitude: 115.2167 },
];

test('distanceKm menghitung jarak antar titik (haversine)', () => {
  // Jakarta (Monas) ke Bandung sekitar 120 km.
  const d = distanceKm(-6.1754, 106.8272, -6.9175, 107.6098);
  assert.ok(d > 110 && d < 130, `jarak Jakarta–Bandung tidak wajar: ${d}`);
  assert.equal(distanceKm(-6.1, 106.8, -6.1, 106.8), 0);
});

test('isInIndonesia menolak koordinat di luar cakupan', () => {
  assert.equal(isInIndonesia(-6.2, 106.8), true);
  assert.equal(isInIndonesia(1.5, 124.8), true);
  assert.equal(isInIndonesia(48.85, 2.35), false); // Paris
  assert.equal(isInIndonesia(-33.9, 151.2), false); // Sydney
});

test('nearestArea memilih kecamatan terdekat', () => {
  const jakarta = nearestArea(AREAS, -6.18, 106.82);
  assert.equal(jakarta?.area.code, '31.71.01.1003');
  assert.ok(jakarta && jakarta.distanceKm < 5);

  const bandung = nearestArea(AREAS, -6.92, 107.62);
  assert.equal(bandung?.area.code, '32.73.11.1001');

  assert.equal(nearestArea([], -6.2, 106.8), null);
});

/* -------------------------------------------------------- titik prakiraan -- */

const RAW_POINT = {
  datetime: '2026-10-28T22:00:00Z',
  t: 25,
  tcc: 99,
  tp: 0,
  weather: 3,
  weather_desc: 'Berawan',
  wd: 'S',
  wd_to: 'N',
  ws: 1.6,
  hu: 94,
  vs: null,
  vs_text: null,
  analysis_date: '2026-10-28T12:00:00',
  image: 'https://api-apps.bmkg.go.id/storage/icon/cuaca/berawan-pm.svg',
  local_datetime: '2026-10-29 05:00:00',
};

test('normalizeWeatherPoint memakai waktu lokal + offset zona', () => {
  const point = normalizeWeatherPoint(RAW_POINT, 'Asia/Jakarta');
  assert.ok(point);
  assert.equal(point.time, '2026-10-29T05:00:00+07:00');
  assert.equal(point.temperatureC, 25);
  assert.equal(point.description, 'Berawan');
  assert.equal(point.humidityPct, 94);
  assert.equal(point.windSpeedKmh, 1.6);
  assert.equal(point.precipitationMm, 0);
  assert.equal(point.visibilityM, null);
  assert.equal(point.iconUrl, 'https://api-apps.bmkg.go.id/storage/icon/cuaca/berawan-pm.svg');
});

test('normalizeWeatherPoint memakai WITA dan menolak baris tanpa waktu', () => {
  const makassar = normalizeWeatherPoint({ ...RAW_POINT, local_datetime: '2026-10-29 06:00:00' }, 'Asia/Makassar');
  assert.equal(makassar?.time, '2026-10-29T06:00:00+08:00');
  assert.equal(normalizeWeatherPoint({ t: 20 }, 'Asia/Jakarta'), null);
});

test('normalizeWeatherPoint memakai offset yang sudah ada pada zona', () => {
  const point = normalizeWeatherPoint({ ...RAW_POINT, local_datetime: '2026-10-29 06:00:00' }, '+0800');
  assert.equal(point?.time, '2026-10-29T06:00:00+0800');
});

test('zoneFromOffset mengubah offset BMKG menjadi nama zona', () => {
  assert.equal(zoneFromOffset('+0700'), 'Asia/Jakarta');
  assert.equal(zoneFromOffset('+08:00'), 'Asia/Makassar');
  assert.equal(zoneFromOffset('+0900'), 'Asia/Jayapura');
  assert.equal(zoneFromOffset('+0530'), null);
  assert.equal(zoneFromOffset(null), null);
});

/* ------------------------------------------------------------ pengelompokan -- */

const points: WeatherPoint[] = [
  { time: '2026-10-29T07:00:00+07:00', temperatureC: 26, cloudCoverPct: 40, precipitationMm: 0, weatherCode: 1, description: 'Cerah', humidityPct: 80, windSpeedKmh: 5, windFrom: 'E', windTo: 'W', visibilityM: null, visibilityText: null, iconUrl: null },
  { time: '2026-10-29T13:00:00+07:00', temperatureC: 30, cloudCoverPct: 60, precipitationMm: 4, weatherCode: 60, description: 'Hujan Lebat', humidityPct: 90, windSpeedKmh: 12, windFrom: 'NW', windTo: 'SE', visibilityM: 2000, visibilityText: '2 km', iconUrl: null },
  { time: '2026-10-30T07:00:00+07:00', temperatureC: 25, cloudCoverPct: 90, precipitationMm: 0.5, weatherCode: 3, description: 'Berawan', humidityPct: 88, windSpeedKmh: 3, windFrom: 'S', windTo: 'N', visibilityM: null, visibilityText: null, iconUrl: null },
];

test('groupByLocalDate mengelompokkan dan mengurutkan per tanggal lokal', () => {
  const groups = groupByLocalDate([points[2], points[1], points[0]]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((g) => g.date), ['2026-10-29', '2026-10-30']);
  assert.equal(groups[0].points.length, 2);
  assert.equal(groups[0].points[0].description, 'Cerah');
});

test('isSignificantWeather menandai hujan lebat dan angka hujan', () => {
  assert.equal(isSignificantWeather(points[0]), false);
  assert.equal(isSignificantWeather(points[1]), true);
  assert.equal(isSignificantWeather({ ...points[0], description: 'Berawan', precipitationMm: 0 }), false);
  assert.equal(isSignificantWeather({ ...points[0], description: 'Hujan Ringan', precipitationMm: null }), true);
});

test('dayLabel mengenali hari ini, besok, dan tanggal lain', () => {
  const now = new Date(2026, 9, 29, 8, 0, 0); // 29 Oktober 2026
  assert.equal(dayLabel('2026-10-29', now), 'Hari ini');
  assert.equal(dayLabel('2026-10-30', now), 'Besok');
  assert.match(dayLabel('2026-11-01', now), /Nov/);
});

test('dateLabel menulis tanggal lengkap Bahasa Indonesia', () => {
  assert.match(dateLabel('2026-10-29'), /Oktober 2026/);
  assert.equal(dateLabel('bukan-tanggal'), 'bukan-tanggal');
});

/* --------------------------------------------------------- peringatan dini -- */

const NOWCAST_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Peringatan Dini Cuaca BMKG</title>
  <pubDate>Wed, 28 Oct 2026 21:45:10 +0000</pubDate>
  <item>
    <title>Hujan Lebat disertai Petir di Bali</title>
    <link>https://www.bmkg.go.id/alerts/nowcast/id/CBL20261028005_alert.xml</link>
    <description>Hujan lebat disertai petir akan terjadi pada 29 October 2026, 04:55 WITA di sebagian wilayah Bali, khususnya DENPASAR, KUTA.
 Kondisi ini berpotensi menimbulkan dampak berupa jarak pandang berkurang, angin kencang, dan banjir lokal.
 Masyarakat dihimbau untuk tetap waspada.
 Kondisi diperkirakan dapat berlangsung hingga 29 October 2026, 08:15 WITA.</description>
    <guid isPermaLink="false">2.49.0.1.360.0.2026.10.28.21.64.005</guid>
    <pubDate>Thu, 29 Oct 2026 04:55:00 +0800</pubDate>
  </item>
  <item>
    <title>Tanpa tanggal</title>
    <link>https://www.bmkg.go.id/alerts/nowcast/id/x.xml</link>
  </item>
</channel></rss>`;

test('parseRssItems mengurai judul channel dan item nowcast', () => {
  const parsed = parseRssItems(NOWCAST_RSS);
  assert.equal(parsed.channelTitle, 'Peringatan Dini Cuaca BMKG');
  assert.equal(parsed.channelDate, 'Wed, 28 Oct 2026 21:45:10 +0000');
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].id, '2.49.0.1.360.0.2026.10.28.21.64.005');
  assert.match(parsed.items[0].description, /jarak pandang berkurang/);
});

test('normalizeWeatherAlert mengurai wilayah, dampak, dan waktu berakhir', () => {
  const item = parseRssItems(NOWCAST_RSS).items[0];
  const alert = normalizeWeatherAlert(item);
  assert.ok(alert);
  assert.equal(alert.title, 'Hujan Lebat disertai Petir di Bali');
  assert.equal(alert.region, 'Bali');
  assert.equal(alert.issuedAt, '2026-10-28T20:55:00.000Z');
  assert.deepEqual(alert.impacts, ['jarak pandang berkurang', 'angin kencang', 'banjir lokal']);
  assert.ok(alert.advice?.includes('dihimbau'));
  assert.ok(alert.expiresAt, 'waktu berakhir harus terurai');
  assert.equal(alert.sourceUrl, 'https://www.bmkg.go.id/alerts/nowcast/id/CBL20261028005_alert.xml');
});

test('normalizeWeatherAlert menolak item yang tidak lengkap', () => {
  const item = parseRssItems(NOWCAST_RSS).items[1];
  assert.equal(normalizeWeatherAlert(item), null);
  assert.equal(normalizeWeatherAlert({}), null);
  assert.equal(normalizeWeatherAlert({ title: 'a', id: 'b', pubDate: 'bukan tanggal' }), null);
});

/* ------------------------------------------------------------------ teks -- */

const FORECAST: WeatherForecast = {
  area: AREAS[0],
  timezone: 'Asia/Jakarta',
  points,
  analysisAt: '2026-10-28T12:00:00',
  fetchedAt: '2026-10-29T00:00:00.000Z',
  updatedAt: null,
  stale: false,
  error: null,
  sourceUrl: 'https://www.bmkg.go.id/cuaca/prakiraan-cuaca/31.71.01.1003',
};

const ALERT: WeatherAlert = {
  id: 'cap-1',
  title: 'Hujan Lebat disertai Petir di Bali',
  region: 'Bali',
  issuedAt: '2026-10-28T20:55:00.000Z',
  description: 'Hujan lebat disertai petir di sebagian wilayah Bali.\nHarap waspada.',
  impacts: ['jarak pandang berkurang', 'banjir lokal'],
  advice: 'Masyarakat dihimbau untuk tetap waspada.',
  expiresAt: '2026-10-29T00:15:00.000Z',
  sourceUrl: 'https://www.bmkg.go.id/alerts/nowcast/id/CBL.xml',
};

test('weatherForecastText memuat wilayah, kode BMKG, dan kredit sumber', () => {
  const text = weatherForecastText(FORECAST, { pageUrl: 'https://seismos.anargya.my.id/cuaca' });
  assert.match(text, /^PRAKIRAAN CUACA — GAMBIR/m);
  assert.match(text, /Wilayah: Gambir, Gambir, Kota Adm\. Jakarta Pusat, DKI Jakarta/);
  assert.match(text, /Kode wilayah BMKG: 31\.71\.01\.1003/);
  assert.match(text, /Cerah/);
  assert.match(text, /Hujan Lebat/);
  assert.match(text, /Laporan dari Seismos Indonesia/);
  assert.ok(text.includes(SOURCE_BMKG_WEATHER));
  // Hanya angka yang diterbitkan BMKG; titik berjarak pandang kosong tidak mengarang nilai.
  assert.doesNotMatch(text, /undefined|null|NaN/);
});

test('weatherForecastText menghormati batas jumlah titik', () => {
  const text = weatherForecastText(FORECAST, { maxPoints: 1 });
  const pointLines = text.split('\n').filter((line) => line.startsWith('- '));
  assert.equal(pointLines.length, 1);
});

test('weatherAlertText memuat dampak, imbauan, dan kredit sumber', () => {
  const text = weatherAlertText(ALERT);
  assert.match(text, /^PERINGATAN DINI CUACA EKSTREM/);
  assert.match(text, /Judul: Hujan Lebat disertai Petir di Bali/);
  assert.match(text, /Wilayah: Bali/);
  assert.match(text, /Potensi dampak:/);
  assert.match(text, /- banjir lokal/);
  assert.match(text, /Imbauan: Masyarakat dihimbau/);
  assert.ok(text.includes(SOURCE_BMKG_WEATHER));
});

/* --------------------------------------------------------------- satelit -- */

test('katalog satelit berisi produk unik dengan alamat INDERAJA BMKG', () => {
  const ids = new Set(SATELLITE_PRODUCTS.map((p) => p.id));
  assert.equal(ids.size, SATELLITE_PRODUCTS.length, 'ID produk harus unik');
  for (const product of SATELLITE_PRODUCTS) {
    const url = new URL(product.sourceUrl);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'inderaja.bmkg.go.id');
    assert.ok(product.width > 0 && product.height > 0);
    assert.ok(product.name.length > 0 && product.description.length > 0);
  }
  assert.deepEqual(
    [...new Set(SATELLITE_PRODUCTS.map((p) => p.group))].sort(),
    ['gk2a', 'gsmap', 'himawari', 'lingkungan'],
  );
});
