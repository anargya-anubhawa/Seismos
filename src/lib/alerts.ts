import type { Earthquake } from '@/types/earthquake';

/** Ambang gempa yang dianggap penting untuk alarm (mengikuti kebiasaan peringatan M5+). */
export const ALERT_MIN_MAGNITUDE = 5;

type AlertEvent = Pick<Earthquake, 'magnitude' | 'feltReports' | 'maxMmi'>;

/** Gempa penting: magnitudo minimal 5,0 atau memiliki laporan guncangan dirasakan. */
export function isSignificantEarthquake(event: AlertEvent): boolean {
  return (
    event.magnitude >= ALERT_MIN_MAGNITUDE ||
    (event.feltReports?.length ?? 0) > 0 ||
    (event.maxMmi ?? 0) > 0
  );
}
