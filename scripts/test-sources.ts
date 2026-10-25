import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFeltEventsXml, parseLiveEventsXml } from '../src/services/bmkg/xml';

test('feed live InaTEWS: waktu UTC, koordinat, dan area terbaca', () => {
  const xml = `<?xml version="1.0"?>
  <Infogempa>
    <gempa>
      <eventid>bmg2026uwjg</eventid>
      <status>confirmed</status>
      <waktu>2026/10/24  20:23:22.966</waktu>
      <lintang>-7.36</lintang>
      <bujur>129.38</bujur>
      <dalam>133</dalam>
      <mag>4.4</mag>
      <fokal>undetermined</fokal>
      <area>Banda Sea</area>
    </gempa>
    <gempa>
      <eventid>rusak</eventid>
      <waktu>bukan-waktu</waktu>
      <lintang>-7.36</lintang>
      <bujur>129.38</bujur>
      <dalam>10</dalam>
      <mag>3.0</mag>
      <area>Diabaikan</area>
    </gempa>
  </Infogempa>`;

  const rows = parseLiveEventsXml(xml);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    DateTime: '2026-10-24T20:23:22.966Z',
    Coordinates: '-7.36,129.38',
    Lintang: '-7.36',
    Bujur: '129.38',
    Magnitude: '4.4',
    Kedalaman: '133',
    Wilayah: 'Banda Sea',
    Potensi: undefined,
    Dirasakan: undefined,
  });
});

test('feed CAP gempa dirasakan: WIB dikonversi ke UTC dan felt dipertahankan', () => {
  const xml = `<alert><info>
    <date>22-10-26</date>
    <time>17:57:49 WIB</time>
    <latitude>3.11 LS</latitude>
    <longitude>102.14 BT</longitude>
    <magnitude>5.2</magnitude>
    <depth>120 Km</depth>
    <area>Pusat gempa berada di darat 6 km BaratLaut Lebong</area>
    <felt>III Kota Bengkulu, II - III Curup</felt>
    <shakemap>20261022175749.mmi.jpg</shakemap>
  </info></alert>`;

  const rows = parseFeltEventsXml(xml);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].DateTime, '2026-10-22T10:57:49.000Z');
  assert.equal(rows[0].Coordinates, '-3.11,102.14');
  assert.equal(rows[0].Wilayah, 'Pusat gempa berada di darat 6 km BaratLaut Lebong');
  assert.equal(rows[0].Dirasakan, 'III Kota Bengkulu, II - III Curup');
  assert.equal(rows[0].Shakemap, '20261022175749.mmi.jpg');
});
