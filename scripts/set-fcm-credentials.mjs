#!/usr/bin/env node
/**
 * Menyalin kredensial FCM dari file service account JSON ke `web-source/.env`.
 *
 * Mengapa skrip ini ada: private key tidak boleh ditempel ke percakapan, chat, atau docs.
 * Skrip membaca file JSON dari disk, lalu menulis/mengganti tiga baris `FCM_*` di `.env`
 * (yang sudah gitignored). Nilai TIDAK pernah dicetak — hanya status ada/tidaknya.
 *
 * Pakai:
 *   export PATH=~/node-toolchain/node-v24.22.2-linux-x64/bin:$PATH
 *   node scripts/set-fcm-credentials.mjs ~/seismos-fcm-sa.json
 *
 * Verifikasi saja (tanpa menulis): tambahkan --check
 *   node scripts/set-fcm-credentials.mjs --check
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const source = args.find((a) => !a.startsWith('--'));

function fail(message) {
  console.error(`GAGAL: ${message}`);
  process.exit(1);
}

/** FCM_PRIVATE_KEY disimpan satu baris dengan \n literal; kode server mengubahnya lagi. */
function oneLineKey(privateKey) {
  return privateKey.replace(/\r/g, '').replace(/\n/g, '\\n');
}

function validateServiceAccountJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail('file bukan JSON yang valid');
  }
  if (parsed.type !== 'service_account') fail('field "type" bukan "service_account"');
  for (const field of ['project_id', 'client_email', 'private_key']) {
    if (typeof parsed[field] !== 'string' || !parsed[field].trim()) {
      fail(`field "${field}" kosong atau hilang`);
    }
  }
  if (!parsed.private_key.includes('BEGIN PRIVATE KEY')) {
    fail('"private_key" tidak berisi blok PEM ("BEGIN PRIVATE KEY")');
  }
  if (!parsed.client_email.endsWith('.gserviceaccount.com')) {
    fail('"client_email" bukan alamat service account');
  }
  return parsed;
}

function readEnv() {
  if (!existsSync(envPath)) return '';
  return readFileSync(envPath, 'utf8');
}

/** Mengganti (atau menambah) satu variabel tanpa menyentuh baris lain. */
function setVar(text, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(text)) return text.replace(pattern, line);
  const trimmed = text.length && !text.endsWith('\n') ? `${text}\n` : text;
  return `${trimmed}${line}\n`;
}

function check() {
  const text = readEnv();
  const find = (key) => {
    const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  const projectId = find('FCM_PROJECT_ID');
  const clientEmail = find('FCM_CLIENT_EMAIL');
  const privateKey = find('FCM_PRIVATE_KEY').replace(/\\n/g, '\n');
  console.log('--- status kredensial FCM di web-source/.env (nilai disembunyikan) ---');
  console.log(`FCM_PROJECT_ID    : ${projectId ? 'terisi' : 'KOSONG'}`);
  console.log(`FCM_CLIENT_EMAIL  : ${clientEmail ? 'terisi' : 'KOSONG'}`);
  console.log(
    `FCM_PRIVATE_KEY   : ${privateKey ? `terisi (${privateKey.length} karakter, PEM ${privateKey.includes('BEGIN PRIVATE KEY') ? 'valid' : 'TIDAK valid'})` : 'KOSONG'}`,
  );
  const ready = Boolean(projectId && clientEmail && privateKey.includes('BEGIN PRIVATE KEY'));
  console.log(`Kesimpulan        : ${ready ? 'SIAP dipakai (server akan mengirim push)' : 'BELUM siap (push nonaktif, /test membalas 503)'}`);
  return ready;
}

if (checkOnly || !source) {
  const ready = check();
  if (!source && !checkOnly) {
    console.log('\nPakai: node scripts/set-fcm-credentials.mjs <file-service-account.json>');
  }
  process.exit(ready ? 0 : 1);
}

if (!existsSync(source)) fail(`file tidak ditemukan: ${source}`);
const credentials = validateServiceAccountJson(readFileSync(source, 'utf8'));

let text = readEnv();
if (!text.trim() && existsSync(examplePath)) {
  // Mulai dari .env.example supaya variabel lain (BMKG, keamanan) tetap ada.
  text = readFileSync(examplePath, 'utf8');
  console.log('info: .env belum ada -> dibuat dari .env.example');
}
text = setVar(text, 'FCM_PROJECT_ID', credentials.project_id);
text = setVar(text, 'FCM_CLIENT_EMAIL', credentials.client_email);
text = setVar(text, 'FCM_PRIVATE_KEY', `"${oneLineKey(credentials.private_key)}"`);
writeFileSync(envPath, text, { mode: 0o600 });

console.log(`OK: kredensial dari ${source} ditulis ke ${envPath} (mode 600).`);
console.log(`project_id: ${credentials.project_id}`);
console.log(`client_email: ${credentials.client_email}`);
console.log('Private key TIDAK dicetak. Jalankan dengan --check untuk memverifikasi.');
check();
