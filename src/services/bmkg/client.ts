export interface FetchOptions {
  timeoutMs: number;
  retries: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(url: string, { timeoutMs, retries }: FetchOptions, accept: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctl.signal,
        cache: 'no-store',
        headers: { Accept: accept },
      });
      if (!res.ok) throw new Error(`Sumber data membalas HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastError =
        e instanceof Error && e.name === 'AbortError'
          ? new Error(`Waktu tunggu ${timeoutMs} ms habis`)
          : e;
      if (attempt < retries) await sleep(400 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gagal mengambil data dari sumber');
}

/** GET JSON dengan timeout dan retry terbatas (jeda bertambah). Hanya dipanggil dari server. */
export async function fetchJson(url: string, options: FetchOptions): Promise<unknown> {
  const res = await request(url, options, 'application/json');
  try {
    return await res.json();
  } catch {
    throw new Error('Respons sumber bukan JSON yang valid');
  }
}

/** GET teks/XML dengan timeout dan retry terbatas. Hanya dipanggil dari server. */
export async function fetchText(url: string, options: FetchOptions): Promise<string> {
  const res = await request(url, options, 'application/xml, text/xml, */*');
  return res.text();
}
