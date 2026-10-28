import {
  getActivityReport, getActivityReports, getCameras, getDailyReports, getEruptions, getGallery,
  getKrbMaps, getLevelHistory, getVolcanoStatuses, getVonaNotices,
} from '@/services/magma/volcano';
import { getSeismograms } from '@/services/magma';
import {
  MAGMA_SOURCE_REF, MAGMA_SOURCES, seismogramsForVolcano, volcanoSlug,
} from '@/lib/volcano/magma';
import type {
  SeismogramStationRef, VolcanoDetail, VolcanoLevelChange, VolcanoReport, VolcanoStatusSummary,
} from '@/types/volcano';

/**
 * Lapisan layanan gunung api: menggabungkan beberapa endpoint MAGMA menjadi
 * struktur yang dipakai UI, menandai data lama (stale), dan mencatat kesalahan
 * per bagian tanpa membuat data pengganti.
 */

export interface StatusResult {
  volcanoes: Awaited<ReturnType<typeof getVolcanoStatuses>>['value'];
  summary: VolcanoStatusSummary;
  updatedAt: string | null;
  stale: boolean;
  error: string | null;
}

export async function getStatuses(): Promise<StatusResult> {
  const result = await getVolcanoStatuses();
  const byLevel: VolcanoStatusSummary['byLevel'] = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const volcano of result.value) byLevel[volcano.level] += 1;
  const updatedAt = new Date(result.at).toISOString();
  return {
    volcanoes: result.value,
    summary: {
      total: result.value.length,
      byLevel,
      stale: result.stale,
      error: result.error,
      updatedAt,
      source: MAGMA_SOURCE_REF,
    },
    updatedAt,
    stale: result.stale,
    error: result.error,
  };
}

export interface OverviewResult {
  summary: VolcanoStatusSummary;
  volcanoes: StatusResult['volcanoes'];
  latestReports: VolcanoReport[];
  latestEruptions: Awaited<ReturnType<typeof getEruptions>>['value'];
  latestVona: Awaited<ReturnType<typeof getVonaNotices>>['value'];
  reportDate: string | null;
  updatedAt: string | null;
  errors: string[];
}

/** Data dashboard: status, laporan aktivitas, letusan resmi, dan VONA terbaru. */
export async function getOverview(): Promise<OverviewResult> {
  const errors: string[] = [];
  const [statuses, reports, eruptions, vona] = await Promise.all([
    getStatuses(),
    getActivityReports({ size: 12 }).catch(() => null),
    getEruptions(10).catch(() => null),
    getVonaNotices(8).catch(() => null),
  ]);
  if (statuses.error) errors.push(`Status aktivitas: ${statuses.error}`);
  if (!reports) errors.push('Laporan aktivitas MAGMA tidak dapat dimuat.');
  else if (reports.error) errors.push(`Laporan aktivitas: ${reports.error}`);
  if (!eruptions) errors.push('Informasi letusan MAGMA tidak dapat dimuat.');
  else if (eruptions.error) errors.push(`Informasi letusan: ${eruptions.error}`);
  if (!vona) errors.push('VONA MAGMA tidak dapat dimuat.');
  else if (vona.error) errors.push(`VONA: ${vona.error}`);

  const latestReports = reports?.value ?? [];
  const reportDate = latestReports.reduce<string | null>(
    (latest, report) => (latest === null || report.date > latest ? report.date : latest),
    null,
  );
  const stamps = [statuses.updatedAt, reports ? new Date(reports.at).toISOString() : null]
    .filter((value): value is string => typeof value === 'string');

  return {
    summary: statuses.summary,
    volcanoes: statuses.volcanoes,
    latestReports,
    latestEruptions: eruptions?.value ?? [],
    latestVona: vona?.value ?? [],
    reportDate,
    updatedAt: stamps.sort().pop() ?? null,
    errors,
  };
}

/** Cari gunung api berdasarkan kode resmi (mis. MER) atau slug nama internal. */
export async function findVolcano(codeOrSlug: string) {
  const statuses = await getStatuses();
  const target = codeOrSlug.trim().toLowerCase();
  const volcano = statuses.volcanoes.find((item) => item.code.toLowerCase() === target)
    ?? statuses.volcanoes.find((item) => volcanoSlug(item.code, item.name) === target);
  return { volcano, statuses };
}

const sameName = (left: string, right: string): boolean =>
  left.trim().toLowerCase() === right.trim().toLowerCase();

/** Seluruh data satu gunung api untuk halaman detail. */
export async function getVolcanoDetail(codeOrSlug: string): Promise<VolcanoDetail | null> {
  const { volcano, statuses } = await findVolcano(codeOrSlug);
  if (!volcano) return null;

  const errors: string[] = [];
  if (statuses.error) errors.push(`Status aktivitas: ${statuses.error}`);

  const [levelHistory, eruptions, vona, cameras, krb, gallery, daily, seismograms, reports] = await Promise.all([
    getLevelHistory({ id: volcano.id, code: volcano.code, name: volcano.name }).catch(() => null),
    getEruptions(80).catch(() => null),
    getVonaNotices(60).catch(() => null),
    getCameras().catch(() => null),
    getKrbMaps().catch(() => null),
    getGallery(volcano.name, 12).catch(() => null),
    getDailyReports().catch(() => null),
    getSeismograms().catch(() => null),
    getActivityReports({ size: 40 }).catch(() => null),
  ]);

  if (!levelHistory) errors.push('Riwayat tingkat aktivitas tidak dapat dimuat.');
  else if (levelHistory.error) errors.push(`Riwayat tingkat aktivitas: ${levelHistory.error}`);
  if (!eruptions) errors.push('Informasi letusan tidak dapat dimuat.');
  else if (eruptions.error) errors.push(`Informasi letusan: ${eruptions.error}`);
  if (!vona) errors.push('VONA tidak dapat dimuat.');
  else if (vona.error) errors.push(`VONA: ${vona.error}`);
  if (!cameras) errors.push('Daftar CCTV tidak dapat dimuat.');
  else if (cameras.error) errors.push(`CCTV: ${cameras.error}`);
  if (!krb) errors.push('Daftar peta KRB tidak dapat dimuat.');
  else if (krb.error) errors.push(`Peta KRB: ${krb.error}`);
  if (!gallery) errors.push('Gallery tidak dapat dimuat.');
  else if (gallery.error) errors.push(`Gallery: ${gallery.error}`);
  if (!daily) errors.push('Laporan harian tidak dapat dimuat.');
  else if (daily.error) errors.push(`Laporan harian: ${daily.error}`);
  if (!seismograms) errors.push('Seismogram tidak dapat dimuat.');
  else if (seismograms.error) errors.push(`Seismogram: ${seismograms.error}`);
  if (!reports) errors.push('Laporan aktivitas tidak dapat dimuat.');

  const matches = (code: string, name: string): boolean => code === volcano.code || sameName(name, volcano.name);

  const seismogramRefs: SeismogramStationRef[] = seismograms
    ? seismogramsForVolcano(seismograms.stations, volcano.code, volcano.name)
    : [];

  const levelChanges: VolcanoLevelChange[] = [...(levelHistory?.value ?? [])]
    .sort((a, b) => (b.changeDate ?? '').localeCompare(a.changeDate ?? ''));

  const volcanoEruptions = (eruptions?.value ?? [])
    .filter((event) => matches(event.volcanoCode, event.volcanoName))
    .slice(0, 20);

  const volcanoVona = (vona?.value ?? [])
    .filter((notice) => sameName(notice.volcanoName, volcano.name))
    .slice(0, 10);

  const volcanoCameras = (cameras?.value ?? []).filter((camera) => camera.volcanoCode === volcano.code);

  const krbMap = (krb?.value ?? []).find((map) => sameName(map.volcanoName, volcano.name)) ?? null;
  if ((krb?.value ?? []).length > 0 && !krbMap) {
    errors.push('MAGMA tidak menerbitkan berkas peta KRB untuk gunung api ini.');
  }

  const latestReport = (reports?.value ?? []).find((report) => matches(report.volcanoCode, report.volcanoName)) ?? null;
  const dailyReport = (daily?.value.reports ?? []).find((report) => matches(report.volcanoCode, report.volcanoName)) ?? null;

  return {
    volcano,
    levelChangedAt: levelChanges[0]?.changeDate ?? null,
    latestReport,
    dailyReport,
    levelHistory: levelChanges,
    eruptions: volcanoEruptions,
    vona: volcanoVona,
    cameras: volcanoCameras,
    krb: krbMap,
    gallery: gallery?.value ?? [],
    seismograms: seismogramRefs,
    updatedAt: new Date().toISOString(),
    errors,
    sources: [
      { name: MAGMA_SOURCE_REF.name, url: MAGMA_SOURCES.status },
      { name: 'Informasi letusan (VEN) MAGMA', url: MAGMA_SOURCES.eruptions },
      { name: 'VONA MAGMA', url: MAGMA_SOURCES.vona },
    ],
  };
}

export {
  getActivityReport, getActivityReports, getCameras, getDailyReports, getEruptions, getGallery, getKrbMaps,
  getVonaNotices,
};
