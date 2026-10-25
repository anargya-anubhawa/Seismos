/**
 * Pengurai XML kecil untuk feed InaTEWS/BMKG. Tidak memakai parser DOM karena
 * kode ini hanya berjalan di server dan bentuk feed-nya stabil.
 */

type Raw = Record<string, unknown>;

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};

function decode(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&([a-zA-Z]+);/g, (m, name: string) => ENTITIES[name] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]).trim() : '';
}

function numeric(value: string): number {
  const n = Number(String(value).replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** "3.11 LS" -> -3.11; "102.14 BT" -> 102.14. */
function signedCoordinate(value: string): number {
  const n = numeric(value);
  if (!Number.isFinite(n)) return NaN;
  return /LS|BB|S|W/i.test(value) ? -Math.abs(n) : n;
}

/** Waktu InaTEWS live: "2026/10/24  20:35:08.212" (UTC). */
function parseLiveTime(value: string): string {
  const m = value.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (!m) return '';
  const ms = Number((m[7] ?? '').padEnd(3, '0').slice(0, 3));
  return new Date(Date.UTC(
    Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4]), Number(m[5]), Number(m[6]), Number.isFinite(ms) ? ms : 0,
  )).toISOString();
}

/** Tanggal/jam CAP: "22-10-26" + "17:57:49 WIB" -> ISO UTC. */
function parseWibTime(date: string, time: string): string {
  const d = date.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  const t = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!d || !t) return '';
  const year = Number(d[3]) < 100 ? 2000 + Number(d[3]) : Number(d[3]);
  return new Date(Date.UTC(
    year, Number(d[2]) - 1, Number(d[1]),
    Number(t[1]) - 7, Number(t[2]), Number(t[3] ?? 0),
  )).toISOString();
}

/**
 * Feed live InaTEWS: <Infogempa><gempa>...</gempa></Infogempa>.
 * Dikembalikan dalam bentuk mirip JSON BMKG agar normalizer yang sama dipakai.
 */
export function parseLiveEventsXml(xml: string): Raw[] {
  const blocks = Array.from(xml.matchAll(/<gempa(?:\s[^>]*)?>([\s\S]*?)<\/gempa>/gi));
  const out: Raw[] = [];
  for (const [, block] of blocks) {
    const lat = numeric(tag(block, 'lintang'));
    const lon = numeric(tag(block, 'bujur'));
    const when = parseLiveTime(tag(block, 'waktu'));
    if (!when || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      DateTime: when,
      Coordinates: `${lat},${lon}`,
      Lintang: String(lat),
      Bujur: String(lon),
      Magnitude: tag(block, 'mag'),
      Kedalaman: tag(block, 'dalam'),
      Wilayah: tag(block, 'area'),
      Potensi: undefined,
      Dirasakan: undefined,
    });
  }
  return out;
}

/**
 * Feed CAP gempa dirasakan: beberapa <info> berisi data dan <felt>.
 * Dipakai bila ingin memperluas kanal "Gempa Dirasakan" BMKG.
 */
export function parseFeltEventsXml(xml: string): Raw[] {
  const blocks = Array.from(xml.matchAll(/<info(?:\s[^>]*)?>([\s\S]*?)<\/info>/gi));
  const out: Raw[] = [];
  for (const [, block] of blocks) {
    const when = parseWibTime(tag(block, 'date'), tag(block, 'time'));
    const lat = signedCoordinate(tag(block, 'latitude'));
    const lon = signedCoordinate(tag(block, 'longitude'));
    if (!when || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      DateTime: when,
      Coordinates: `${lat},${lon}`,
      Lintang: String(lat),
      Bujur: String(lon),
      Magnitude: tag(block, 'magnitude'),
      Kedalaman: tag(block, 'depth'),
      Wilayah: tag(block, 'area'),
      Dirasakan: tag(block, 'felt') || undefined,
      Shakemap: tag(block, 'shakemap') || undefined,
    });
  }
  return out;
}
