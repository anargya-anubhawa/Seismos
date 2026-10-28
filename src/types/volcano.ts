/** Tingkat aktivitas resmi PVMBG (angka mengikuti field `status` MGMA). */
export type VolcanoLevel = 1 | 2 | 3 | 4;

/** Kode warna VONA resmi untuk penerbangan. */
export type VonaColor = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export interface VolcanoSourceRef {
  name: string;
  url: string;
}

/** Satu gunung api berstatus dari `GET /_api/home/maps`. */
export interface VolcanoStatus {
  id: string;
  code: string;
  name: string;
  province: string;
  city: string | null;
  elevation: number | null;
  latitude: number;
  longitude: number;
  level: VolcanoLevel;
  /** Label resmi apa adanya dari sumber, mis. "Level III (Siaga)". */
  levelLabel: string;
  hasVona: boolean;
  hasVen: boolean;
  sourceId: string;
  /** Waktu status/gunung api diterbitkan sumber (ISO UTC). */
  publishedAt: string | null;
  /** Waktu data diterima server Seismos (ISO UTC). */
  receivedAt: string;
  sourceUrl: string;
}

export interface VolcanoStatusSummary {
  total: number;
  byLevel: Record<VolcanoLevel, number>;
  /** true bila rincian per gunung api sedang memakai data lama/tertunda. */
  stale: boolean;
  error: string | null;
  /** Waktu server mengambil daftar status dari MAGMA. */
  updatedAt: string | null;
  source: VolcanoSourceRef;
}

/** Satu laporan aktivitas (VAR) resmi. */
export interface VolcanoReport {
  id: string;
  slug: string | null;
  volcanoCode: string;
  volcanoName: string;
  province: string | null;
  /** Tanggal periode pengamatan (YYYY-MM-DD) menurut zona waktu pos pengamatan. */
  date: string;
  period: string | null;
  timeZone: string | null;
  level: VolcanoLevel | null;
  levelLabel: string;
  /** Waktu data masuk ke MAGMA (ISO UTC), bila diterbitkan. */
  publishedAt: string | null;
  author: string | null;
  /** Rekomendasi resmi, apa adanya. */
  recommendation: string | null;
  visualText: string | null;
  climatologyText: string | null;
  /** Keterangan lainnya dari laporan (bila ada). */
  remarks: string | null;
  seismic: { name: string; text: string }[];
  /** Gambar pengamatan visual resmi (proxy), bila ada. */
  visualImagePath: string | null;
  /**
   * "aktivitas" = Laporan Aktivitas (VAR per periode 6/12/24 jam),
   * "harian" = Laporan Harian (VAR 24 jam yang diterbitkan harian).
   */
  kind: 'aktivitas' | 'harian';
  sourceUrl: string;
}

export interface VolcanoReportList {
  kind: 'aktivitas' | 'harian';
  reports: VolcanoReport[];
  /** Tanggal laporan harian yang dipakai (YYYY-MM-DD). */
  date: string | null;
  updatedAt: string | null;
  stale: boolean;
  error: string | null;
  source: VolcanoSourceRef;
}

/** Satu perubahan tingkat aktivitas resmi. */
export interface VolcanoLevelChange {
  id: string;
  volcanoId: string;
  volcanoCode: string;
  volcanoName: string;
  province: string | null;
  previousLevel: VolcanoLevel | null;
  currentLevel: VolcanoLevel | null;
  previousLabel: string | null;
  currentLabel: string | null;
  direction: 'NAIK' | 'TURUN' | 'TETAP' | null;
  /** Tanggal penetapan perubahan (YYYY-MM-DD). */
  changeDate: string | null;
  endDate: string | null;
  durationDays: number | null;
  /** Jenis dokumen resmi sumber perubahan (VAR, VEN, PRESS_RELEASE). */
  sourceName: string | null;
  author: string | null;
  sourceUrl: string;
}

/** Informasi letusan (VEN) resmi — satu-satunya sumber yang dipakai untuk notifikasi erupsi. */
export interface EruptionEvent {
  id: string;
  volcanoCode: string;
  volcanoName: string;
  province: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation: number | null;
  /** Waktu letusan (ISO UTC). */
  occurredAt: string;
  /** Waktu laporan diterbitkan sumber, bila berbeda dari waktu letusan. */
  publishedAt: string | null;
  ashHeightM: number | null;
  durationSeconds: number | null;
  /** Teks resmi lengkap. */
  information: string | null;
  recommendation: string | null;
  author: string | null;
  zoneArea: string | null;
  /** Waktu data diterima Seismos. */
  receivedAt: string | null;
  imagePath: string | null;
  sourceUrl: string;
}

/** Notifikasi penerbangan (VONA) resmi. */
export interface VonaNotice {
  id: string;
  volcanoName: string;
  province: string | null;
  /** Waktu penerbitan (ISO UTC). */
  issuedAt: string;
  noticeNumber: string | null;
  previousCode: VonaColor | null;
  currentCode: VonaColor | null;
  ashHeightM: number | null;
  durationMinutes: number | null;
  typeLabel: string | null;
  description: string | null;
  isSent: boolean;
  issuedBy: string | null;
  sourceUrl: string;
}

/** Satu kamera pemantau (gambar CCTV resmi, bukan video). */
export interface VolcanoCamera {
  id: string;
  volcanoCode: string;
  volcanoName: string;
  station: string;
  /** Waktu pengambilan gambar menurut sumber (ISO UTC). */
  capturedAt: string | null;
  /** URL proxy internal untuk gambar kamera. */
  imagePath: string;
  /** URL gambar asli sumber. */
  sourceImageUrl: string;
  sourceUrl: string;
}

/** Satu peta Kawasan Rawan Bencana resmi (berkas gambar, bukan poligon). */
export interface KrbMap {
  id: string;
  volcanoId: string | null;
  volcanoName: string;
  year: string | null;
  description: string | null;
  /** Ukuran berkas menurut sumber (byte). */
  fileSize: number | null;
  fileType: string | null;
  /** Path proxy untuk pratinjau (server meneruskan berkas sumber). */
  imagePath: string;
  downloadPath: string;
  sourceUrl: string;
  sourcePage: string;
}

/** Satu foto dokumentasi visual resmi dari feed gallery MAGMA. */
export interface GalleryPhoto {
  id: string;
  volcanoName: string;
  volcanoCode: string | null;
  /** Waktu unggah visual menurut sumber (ISO UTC). */
  uploadedAt: string | null;
  /** Tanggal pengamatan yang tercantum pada nama berkas sumber (YYYY-MM-DD), bukan tanggal foto. */
  visualDate: string | null;
  imagePath: string;
  sourceUrl: string;
}

export interface SeismogramStationRef {
  id: number;
  volcanoCode: string;
  volcanoName: string;
  scnl: string;
  station: string;
  channel: string;
  imagePath: string;
  pageUrl: string;
}

export interface VolcanoDetail {
  volcano: VolcanoStatus | null;
  levelChangedAt: string | null;
  latestReport: VolcanoReport | null;
  /** Laporan harian terbaru untuk gunung ini, bila ada pada tanggal yang dipublikasikan. */
  dailyReport: VolcanoReport | null;
  levelHistory: VolcanoLevelChange[];
  eruptions: EruptionEvent[];
  vona: VonaNotice[];
  cameras: VolcanoCamera[];
  krb: KrbMap | null;
  gallery: GalleryPhoto[];
  seismograms: SeismogramStationRef[];
  updatedAt: string | null;
  errors: string[];
  sources: VolcanoSourceRef[];
}

/** Satu notifikasi yang diproses server untuk dedupe dan push. */
export type VolcanoNotificationKind =
  | 'level-change'
  | 'eruption'
  | 'vona'
  | 'recommendation';

export interface VolcanoNotification {
  key: string;
  kind: VolcanoNotificationKind;
  volcanoCode: string;
  volcanoName: string;
  title: string;
  body: string;
  url: string;
  /** ID sumber (VEN/VONA/perubahan level) yang menjadi dasar notifikasi. */
  sourceId: string;
  /** Waktu kejadian menurut sumber. */
  occurredAt: string;
  /** Waktu server memproses notifikasi. */
  detectedAt: string;
  delivery: {
    subscribers: number;
    sent: number;
    failed: number;
    attempts: number;
    lastAttemptAt: string | null;
    deliveredAt: string | null;
    status: 'pending' | 'delivered' | 'no-subscribers' | 'failed';
  };
}

export interface VolcanoMonitorStatus {
  lastCheckAt: string | null;
  lastSuccessAt: string | null;
  checkCount: number;
  pollSeconds: number;
  sources: {
    id: string;
    label: string;
    url: string;
    fetchedAt: string | null;
    ok: boolean;
    stale: boolean;
    error: string | null;
    count: number;
  }[];
  notifications: VolcanoNotification[];
}

/** Ringkasan untuk dashboard Gunung Berapi. */
export interface VolcanoOverview {
  status: VolcanoStatusSummary;
  volcanoes: VolcanoStatus[];
  latestReports: VolcanoReport[];
  latestEruptions: EruptionEvent[];
  latestVona: VonaNotice[];
  levelChanges: VolcanoLevelChange[];
  reportDate: string | null;
  monitor: VolcanoMonitorStatus | null;
  updatedAt: string | null;
  errors: string[];
}

export interface VolcanoFeatureAvailability {
  id: string;
  label: string;
  href: string | null;
  available: boolean;
  note: string;
}

export const VOLCANO_LEVELS: { level: VolcanoLevel; label: string; short: string; description: string }[] = [
  {
    level: 1,
    label: 'Level I — Normal',
    short: 'Normal',
    description: 'Tidak ada perubahan aktivitas secara visual, seismik, dan deformasi yang signifikan. Tidak ada erupsi.',
  },
  {
    level: 2,
    label: 'Level II — Waspada',
    short: 'Waspada',
    description: 'Terjadi peningkatan aktivitas visual dan/atau seismik di atas normal.',
  },
  {
    level: 3,
    label: 'Level III — Siaga',
    short: 'Siaga',
    description: 'Peningkatan aktivitas semakin nyata, erupsi mungkin terjadi.',
  },
  {
    level: 4,
    label: 'Level IV — Awas',
    short: 'Awas',
    description: 'Aktivitas meningkat lanjut menuju erupsi atau erupsi sedang berlangsung.',
  },
];

export const VOLCANO_LEVEL_GLYPH: Record<VolcanoLevel, string> = {
  1: 'N',
  2: 'W',
  3: 'S',
  4: 'A',
};
