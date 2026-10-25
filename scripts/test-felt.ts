import assert from 'node:assert/strict';
import test from 'node:test';
import { maxMmiOf, parseFeltReports } from '../src/lib/felt';

test('memecah contoh BMKG: III Kota Bengkulu, II - III Curup, III Arga Makmur', () => {
  const rows = parseFeltReports('III Kota Bengkulu, II - III Curup, III Arga Makmur');
  assert.equal(rows.length, 3);

  const byPlace = new Map(rows.map((r) => [r.place, r]));
  assert.deepEqual(
    { min: byPlace.get('Kota Bengkulu')?.mmiMin, max: byPlace.get('Kota Bengkulu')?.mmiMax, label: byPlace.get('Kota Bengkulu')?.mmiLabel },
    { min: 3, max: 3, label: 'III' },
  );
  assert.deepEqual(
    { min: byPlace.get('Curup')?.mmiMin, max: byPlace.get('Curup')?.mmiMax, label: byPlace.get('Curup')?.mmiLabel },
    { min: 2, max: 3, label: 'II–III' },
  );
  assert.equal(byPlace.get('Arga Makmur')?.mmiMax, 3);
});

test('koma di dalam nama wilayah tidak dianggap pemisah laporan', () => {
  const rows = parseFeltReports('III Ulu Belu, Tanggamus, III Pulau Panggung, Tanggamus');
  assert.deepEqual(rows.map((r) => r.place).sort(), ['Pulau Panggung, Tanggamus', 'Ulu Belu, Tanggamus']);
  assert.equal(maxMmiOf(rows), 3);
});

test('rentang MMI tanpa spasi dan dengan tanda pisah berbeda', () => {
  assert.deepEqual(
    parseFeltReports('IV-V Kota A, II–III Kota B').map((r) => [r.place, r.mmiMin, r.mmiMax, r.mmiLabel]),
    [['Kota A', 4, 5, 'IV–V'], ['Kota B', 2, 3, 'II–III']],
  );
});

test('entri duplikat dihapus dan teks tanpa MMI menghasilkan daftar kosong', () => {
  assert.equal(parseFeltReports('III Kota, III Kota').length, 1);
  assert.deepEqual(parseFeltReports('Tidak dirasakan'), []);
  assert.deepEqual(parseFeltReports(''), []);
  assert.deepEqual(parseFeltReports(undefined), []);
  assert.equal(maxMmiOf([]), undefined);
});
