import type {
  EruptionEvent, GalleryPhoto, KrbMap, SeismogramStationRef, VolcanoCamera, VolcanoDetail,
  VolcanoLevel, VolcanoLevelChange, VolcanoNotification, VolcanoReport, VonaNotice,
} from '@/types/volcano';

export type VolcanoStatusSummaryData = {
  total: number;
  byLevel: Record<VolcanoLevel, number>;
  stale: boolean;
  error: string | null;
  updatedAt: string | null;
  source: { name: string; url: string };
};

export type VolcanoStatusItem = {
  id: string;
  code: string;
  name: string;
  province: string;
  city: string | null;
  elevation: number | null;
  latitude: number;
  longitude: number;
  level: VolcanoLevel;
  levelLabel: string;
  hasVona: boolean;
  hasVen: boolean;
  receivedAt: string;
};

export type VolcanoOverviewPayload = {
  summary: VolcanoStatusSummaryData;
  volcanoes: VolcanoStatusItem[];
  latestReports: VolcanoReport[];
  latestEruptions: EruptionEvent[];
  latestVona: VonaNotice[];
  reportDate: string | null;
  updatedAt: string | null;
  errors: string[];
  error?: string;
  monitor?: {
    lastCheckAt: string | null;
    lastSuccessAt: string | null;
    checkCount: number;
    pollSeconds: number;
    seeded: boolean;
    sources: { id: string; fetchedAt: string | null; ok: boolean; stale: boolean; error: string | null; count: number }[];
    notifications: VolcanoNotification[];
  };
};

export type VolcanoDetailPayload = VolcanoDetail;

export type VolcanoReportPayload = {
  kind: 'aktivitas' | 'harian';
  reports: VolcanoReport[];
  date: string | null;
  updatedAt: string;
  stale: boolean;
  error: string | null;
  note?: string;
};

export type VolcanoEruptionPayload = {
  eruptions: EruptionEvent[];
  updatedAt: string;
  stale: boolean;
  error: string | null;
};

export type VolcanoCameraPayload = {
  cameras: VolcanoCamera[];
  updatedAt: string;
  stale: boolean;
  error: string | null;
  note: string;
};

export type VolcanoKrbPayload = {
  maps: KrbMap[];
  updatedAt: string;
  stale: boolean;
  error: string | null;
  note: string;
};

export type VolcanoGalleryPayload = {
  photos: GalleryPhoto[];
  search: string | null;
  updatedAt: string;
  stale: boolean;
  error: string | null;
};

export type VolcanoVonaPayload = {
  notices: VonaNotice[];
  updatedAt: string;
  stale: boolean;
  error: string | null;
  note: string;
};

export type VolcanoLevelChangePayload = {
  changes: VolcanoLevelChange[];
  updatedAt: string;
  stale: boolean;
  error: string | null;
};

export type SegmentedStations = SeismogramStationRef[];

export { VOLCANO_LEVELS } from '@/types/volcano';
