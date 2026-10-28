/** Sumber data tsunami resmi yang dipantau server. */
export type TsunamiSourceId = 'datagempa' | 'history';

/** Tingkat peringatan yang dipakai BMKG pada daftar wilayah. */
export type TsunamiLevel = 'AWAS' | 'SIAGA' | 'WASPADA';

export type TsunamiAlertStatus = 'active' | 'ended';

/** Satu wilayah pesisir yang tercantum pada pembaruan BMKG. */
export interface TsunamiRegion {
  province: string;
  district: string;
  level: TsunamiLevel;
  /** Tanggal/waktu resmi wilayah bila dicantumkan BMKG. */
  date: string | null;
  time: string | null;
}

/** Pengamatan muka laut resmi (bila BMKG sudah menerbitkannya). */
export interface TsunamiObservation {
  location: string;
  latitude: number | null;
  longitude: number | null;
  heightM: number | null;
  date: string | null;
  time: string | null;
}

export interface TsunamiMapLinks {
  travelTime: string | null;
  coastalThreat: string | null;
  seaLevel: string | null;
  shakemap: string | null;
}

/** Ringkasan satu pembaruan resmi untuk linimasa detail. */
export interface TsunamiAlertUpdate {
  issueTime: string;
  phase: string | null;
  subject: string;
  status: TsunamiAlertStatus;
  headline: string;
  regionCount: number;
}

export interface TsunamiAlert {
  /** ID stabil aplikasi; tidak berubah saat BMKG memperbarui detail gempa. */
  id: string;
  sourceIds: TsunamiSourceId[];
  sourceEventIds: string[];
  subject: string;
  /** Fase resmi BMKG, mis. PD-1, PD-2, PD-3.4, PD-4. */
  phase: string | null;
  status: TsunamiAlertStatus;
  /** Waktu terbit pembaruan terakhir menurut BMKG (ISO 8601). */
  issueTime: string;
  /** Waktu gempa pemicu menurut BMKG (ISO 8601). */
  originTime: string | null;
  magnitude: number | null;
  depthKm: number | null;
  latitude: number | null;
  longitude: number | null;
  region: string;
  headline: string;
  description: string;
  potential: string;
  instructions: string[];
  regions: TsunamiRegion[];
  /** Waktu pembaruan terakhir yang benar-benar merinci wilayah. */
  regionsIssueTime: string | null;
  observations: TsunamiObservation[];
  maps: TsunamiMapLinks;
  sourceUrl: string;
  sourceName: string;
  /** Kapan aplikasi pertama kali melihat peringatan ini. */
  firstSeenAt: string;
  /** Kapan aplikasi terakhir mengubah data peringatan ini. */
  updatedAt: string;
  endedAt: string | null;
  updates: TsunamiAlertUpdate[];
}

export interface TsunamiSourceStatus {
  id: TsunamiSourceId;
  label: string;
  url: string;
  fetchedAt: string | null;
  /** true bila pengambilan terakhir berhasil dan strukturnya dikenali. */
  ok: boolean;
  /** true bila data terakhir sudah melewati batas kesegaran. */
  stale: boolean;
  error: string | null;
  /** Jumlah catatan resmi yang dipakai dari sumber ini. */
  count: number;
}

/** active = ada peringatan; none = sumber segar dan tidak ada; unknown = tidak dapat dipastikan. */
export type TsunamiFeedState = 'active' | 'none' | 'unknown';

export interface TsunamiFeed {
  state: TsunamiFeedState;
  /** true bila sumber riwayat belum diperbarui dalam batas yang wajar. */
  stale: boolean;
  checkedAt: string | null;
  updatedAt: string | null;
  /** Peringatan yang masih berstatus aktif menurut BMKG. */
  activeAlerts: TsunamiAlert[];
  /** Aktif + peringatan terbaru yang sudah berakhir. */
  alerts: TsunamiAlert[];
  sources: TsunamiSourceStatus[];
  message: string | null;
}

export interface TsunamiPushSubscriptionInput {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface TsunamiPushConfig {
  publicKey: string;
  enabled: boolean;
}
