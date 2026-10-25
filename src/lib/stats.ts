import type { Earthquake } from '@/types/earthquake';

export function summarize(events: Earthquake[], now = Date.now()) {
  const last24h = events.filter((e) => now - Date.parse(e.originTime) <= 86_400_000);
  const latest = [...events].sort((a, b) => b.originTime.localeCompare(a.originTime))[0] ?? null;
  const largest = [...events].sort((a, b) => b.magnitude - a.magnitude)[0] ?? null;
  return {
    total: events.length,
    last24h: last24h.length,
    m5plus: events.filter((e) => e.magnitude >= 5).length,
    latest,
    largest,
  };
}

export function bin<T>(items: T[], edges: { label: string; test: (x: T) => boolean }[]) {
  return edges.map((e) => ({ name: e.label, jumlah: items.filter(e.test).length }));
}
