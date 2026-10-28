import type { TsunamiCandidate } from '@/lib/tsunami/parse';
import {
  DATAGEMPA_URL, INATEWS_TSUNAMI_URL, TSUNAMI_HISTORY_URL, parseDatagempaPayload, parseInatewsCapXml,
  parseTsunamiHistoryHtml,
} from '@/lib/tsunami/parse';

const TIMEOUT_MS = Math.max(2_000, Number(process.env.TSUNAMI_TIMEOUT_MS ?? 12_000));
const DATAGEMPA = (process.env.TSUNAMI_DATAGEMPA_URL ?? DATAGEMPA_URL).trim();
const HISTORY = (process.env.TSUNAMI_HISTORY_URL ?? TSUNAMI_HISTORY_URL).trim();
const INATEWS = (process.env.TSUNAMI_INATEWS_URL ?? INATEWS_TSUNAMI_URL).trim();
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 SeismosIndonesia/1.0 (+https://github.com/anargya-anubhawa/seismos-indonesia)';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mengambil teks dari daftar URL berurutan: URL pertama yang berhasil dipakai.
 * `cdn.bmkg.go.id` dilayani beberapa edge GCS/Cloudflare sehingga satu titik
 * bisa membalas 403 bagi IP datacenter; mencoba URL cadangan menaikkan peluang
 * berhasil tanpa mengubah parser.
 */
async function fetchTextFrom(urls: string[], accept: string, retries: number): Promise<{ text: string; url: string }> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      return { text: await fetchText(url, accept, retries), url };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gagal mengambil sumber tsunami BMKG');
}

async function fetchText(url: string, accept: string, retries: number): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: 'no-store',
        redirect: 'follow',
        headers: {
          Accept: accept,
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
          'User-Agent': USER_AGENT,
        },
      });
      if (!response.ok) throw new Error(`Sumber tsunami membalas HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error instanceof Error && error.name === 'AbortError'
        ? new Error(`Waktu tunggu ${TIMEOUT_MS} ms habis`)
        : error;
      if (attempt < retries) await sleep(500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gagal mengambil sumber tsunami BMKG');
}

export interface DatagempaResult {
  candidate: TsunamiCandidate | null;
  fetchedAt: string;
}

/** Feed WRS: hanya satu info terbaru, bisa berupa gempa biasa (bukan tsunami). */
export async function fetchDatagempa(): Promise<DatagempaResult> {
  const text = await fetchText(DATAGEMPA, 'application/json', 2);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Respons datagempa bukan JSON yang valid');
  }
  const candidate = parseDatagempaPayload(json);
  return { candidate, fetchedAt: new Date().toISOString() };
}

export interface HistoryResult {
  candidates: TsunamiCandidate[];
  fetchedAt: string;
}

/** Halaman riwayat 30 pembaruan; dipakai untuk dedupe, pembaruan, dan PD-4. */
export async function fetchTsunamiHistory(): Promise<HistoryResult> {
  // Halaman www bisa diblokir dari IP datacenter; XML CAP di CDN memuat data
  // yang sama dalam bentuk terstruktur, jadi dipakai sebagai cadangan.
  const htmlAttempt = fetchTextFrom([HISTORY], 'text/html,application/xhtml+xml', 1)
    .then(({ text }) => text);
  try {
    const html = await htmlAttempt;
    const candidates = parseTsunamiHistoryHtml(html);
    if (candidates.length > 0) return { candidates, fetchedAt: new Date().toISOString() };
  } catch {
    /* lanjut ke sumber cadangan */
  }
  return fetchInatewsTsunami();
}

export interface InatewsResult {
  candidates: TsunamiCandidate[];
  fetchedAt: string;
}

/**
 * Arsip CAP InaTEWS (30 pembaruan tsunami terakhir). Sumber cadangan ketiga:
 * terstruktur, tidak butuh render JS, dan memuat `wzarea` serta `obsarea`
 * lengkap sehingga observasi muka laut tetap tersedia.
 */
export async function fetchInatewsTsunami(): Promise<InatewsResult> {
  const { text } = await fetchTextFrom([INATEWS], 'application/xml,text/xml', 1);
  const candidates = parseInatewsCapXml(text);
  return { candidates, fetchedAt: new Date().toISOString() };
}

export const TSUNAMI_SOURCE_URLS = { datagempa: DATAGEMPA, history: HISTORY, inatews: INATEWS };
