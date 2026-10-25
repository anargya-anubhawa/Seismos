'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Bell, BellOff, Loader2, LocateFixed, Play, Send, Settings } from 'lucide-react';
import { ALERT_MIN_MAGNITUDE } from '@/lib/alerts';
import { ALARM_SOUNDS, type AlarmSoundId } from '@/lib/alarms';
import { PROVINCES, nearestProvince, provinceById } from '@/lib/provinces';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNotifications, type AlertArea, type AlertScope } from '@/hooks/useNotifications';

const btn = 'flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium disabled:opacity-40';
const selectCls = 'mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm disabled:opacity-50';

export function NotificationSettings() {
  const {
    ready, supported, permission, enabled, enable, disable, test,
    alarmSupported, alarmEnabled, setAlarmEnabled, alarmSound, setAlarmSound,
    alarmVolume, setAlarmVolume, previewAlarm, scope, setScope,
    area, provinceId, setArea, setProvinceId,
  } = useNotifications();
  const geo = useGeolocation();
  const minMag = ALERT_MIN_MAGNITUDE.toFixed(1).replace('.', ',');
  const selectedSound = ALARM_SOUNDS.find((sound) => sound.id === alarmSound) ?? ALARM_SOUNDS[0];
  const selectedProvince = provinceById(provinceId);

  useEffect(() => {
    if (!geo.location) return;
    setProvinceId(nearestProvince(geo.location).province.id);
  }, [geo.location, setProvinceId]);

  const chooseArea = (next: AlertArea) => {
    setArea(next);
    if (next === 'province' && !provinceId) geo.request();
  };

  if (!ready) {
    return <p role="status" className="text-sm text-muted">Memeriksa dukungan notifikasi…</p>;
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted">
        Browser ini tidak mendukung Notifikasi Web. Di ponsel, gunakan browser yang mendukung Notifikasi Web; aplikasi juga perlu dibuka lewat HTTPS.
      </p>
    );
  }

  const permissionLabel = permission === 'granted'
    ? enabled ? 'Aktif' : 'Diizinkan'
    : permission === 'denied' ? 'Ditolak' : 'Belum diminta';
  const permissionTone = permission === 'denied'
    ? 'text-danger'
    : permission === 'granted' ? 'text-ok' : 'text-muted';
  const permissionHelp = permission === 'denied'
    ? 'Buka pengaturan situs di browser (ikon gembok di bilah alamat) lalu izinkan Notifikasi.'
    : permission === 'granted'
      ? enabled
        ? 'Notifikasi dan alarm aktif untuk sesi ini dan kunjungan berikutnya di browser ini.'
        : 'Izin sudah diberikan; tekan Aktifkan untuk mulai menerima peringatan.'
      : 'Browser akan meminta izin saat Anda menekan Aktifkan.';

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted">
        Notifikasi dan alarm hanya muncul <strong>selama halaman aplikasi terbuka</strong> dan saat data BMKG memuat gempa baru.
        Ini bukan push notification latar belakang; tidak ada data yang dikirim ke server pihak ketiga. Area provinsi memakai
        perkiraan provinsi terdekat dari lokasi Anda, bukan batas administratif resmi.
      </p>

      <div className="rounded-md border border-line bg-bg/60 px-3 py-2.5" role="status" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">Izin notifikasi</span>
          <span className={`font-semibold ${permissionTone}`}>{permissionLabel}</span>
        </div>
        <p className="mt-1 text-xs text-muted">{permissionHelp}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {enabled ? (
          <button className={`${btn} border border-line`} onClick={disable}>
            <BellOff size={15} aria-hidden /> Matikan notifikasi & alarm
          </button>
        ) : (
          <button className={`${btn} bg-accent text-accent-ink`} onClick={() => void enable()} disabled={permission === 'denied'}>
            <Bell size={15} aria-hidden /> Aktifkan notifikasi & alarm
          </button>
        )}
        {enabled && (
          <button className={`${btn} border border-line`} onClick={test}>
            <Send size={15} aria-hidden /> Tes {alarmEnabled && alarmSupported ? 'notifikasi & alarm' : 'notifikasi'}
          </button>
        )}
      </div>

      <div className="space-y-4 rounded-md border border-line p-3">
        <label className="block">
          <span className="mb-1 block text-muted">Peringatkan untuk</span>
          <select className={selectCls} value={scope} onChange={(e) => setScope(e.target.value as AlertScope)}>
            <option value="important">Gempa penting (M≥{minMag} atau dirasakan)</option>
            <option value="all">Semua gempa baru</option>
          </select>
          {!enabled && <span className="mt-1 block text-xs text-muted">Berlaku setelah notifikasi diaktifkan.</span>}
        </label>

        <div className="border-t border-line pt-3">
          <fieldset className="min-w-0">
            <legend className="mb-1 block text-muted">Area peringatan</legend>
            <div className="space-y-2">
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="alert-area"
                  className="mt-0.5 h-4 w-4"
                  checked={area === 'indonesia'}
                  onChange={() => { setArea('indonesia'); geo.clear(); }}
                />
                <span>
                  <span className="block font-medium">Seluruh Indonesia</span>
                  <span className="block text-xs text-muted">Ikuti semua gempa baru sesuai cakupan di atas.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="alert-area"
                  className="mt-0.5 h-4 w-4"
                  checked={area === 'province'}
                  onChange={() => chooseArea('province')}
                />
                <span>
                  <span className="block font-medium">Hanya provinsi sekitar lokasi saya</span>
                  <span className="block text-xs text-muted">
                    Hindari notifikasi seluruh Indonesia; hanya gempa yang terdeteksi di provinsi terdekat dari lokasi Anda.
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {area === 'province' && (
            <div className="mt-3 rounded-md border border-line bg-bg/60 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Provinsi:</span>
                <strong className="text-sm">{selectedProvince?.name ?? 'Belum dipilih'}</strong>
                <button
                  type="button"
                  className={`${btn} ml-auto border border-line`}
                  onClick={() => { setArea('province'); geo.request(); }}
                  disabled={geo.status === 'requesting'}
                >
                  {geo.status === 'requesting'
                    ? <Loader2 size={15} className="animate-spin" aria-hidden />
                    : <LocateFixed size={15} aria-hidden />}
                  {geo.status === 'requesting' ? 'Mendeteksi…' : 'Gunakan lokasi saya'}
                </button>
              </div>

              <label className="mt-2 block text-xs text-muted">
                Atau pilih provinsi
                <select
                  className={selectCls}
                  value={provinceId ?? ''}
                  onChange={(e) => { geo.clear(); setProvinceId(e.target.value || null); }}
                >
                  <option value="">Pilih provinsi…</option>
                  {PROVINCES.map((province) => (
                    <option key={province.id} value={province.id}>{province.name}</option>
                  ))}
                </select>
              </label>

              {geo.error && <p role="alert" className="mt-1 text-xs text-danger">{geo.error}</p>}
              {!provinceId && (
                <p className="mt-1 text-xs text-danger">
                  Pilih provinsi agar notifikasi dan alarm wilayah dapat berjalan.
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                Deteksi memakai titik pusat provinsi terdekat, bukan batas administratif resmi. Gempa di laut atau dekat
                perbatasan dapat masuk ke provinsi tetangga. Filter ini berlaku untuk notifikasi dan alarm.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-line pt-3">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={alarmEnabled}
              disabled={!alarmSupported}
              onChange={(e) => setAlarmEnabled(e.target.checked)}
            />
            <span>
              <span className="block font-medium">Bunyikan alarm</span>
              <span className="block text-xs text-muted">
                Alarm hanya untuk gempa M≥{minMag} atau yang dirasakan, dan mengikuti area peringatan di atas.
                Bukan untuk setiap getaran kecil.
              </span>
            </span>
          </label>

          {!alarmSupported && (
            <p className="mt-2 text-xs text-muted">Browser ini tidak mendukung alarm audio.</p>
          )}
        </div>

        <div className="border-t border-line pt-3">
          <label className="block" htmlFor="alarm-sound">
            <span className="mb-1 block text-muted">Bunyi alarm</span>
            <select
              id="alarm-sound"
              className={selectCls}
              value={alarmSound}
              disabled={!alarmSupported}
              onChange={(e) => setAlarmSound(e.target.value as AlarmSoundId)}
              aria-describedby="alarm-sound-help"
            >
              {ALARM_SOUNDS.map((sound) => (
                <option key={sound.id} value={sound.id}>{sound.label}</option>
              ))}
            </select>
          </label>
          <p id="alarm-sound-help" className="mt-1 text-xs text-muted">{selectedSound.description}</p>

          <div className="mt-3">
            <label htmlFor="alarm-volume" className="flex items-center justify-between gap-3">
              <span>Volume alarm</span>
              <span className="text-xs text-muted">{alarmVolume}%</span>
            </label>
            <input
              id="alarm-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={alarmVolume}
              disabled={!alarmSupported}
              onChange={(e) => setAlarmVolume(Number(e.target.value))}
              className="mt-1 w-full accent-accent disabled:opacity-50"
            />
          </div>

          <button
            className={`${btn} mt-2 border border-line`}
            onClick={previewAlarm}
            disabled={!alarmSupported}
          >
            <Play size={15} aria-hidden /> Coba bunyi alarm
          </button>
        </div>

        <p className="border-t border-line pt-3 text-xs text-muted">
          Alarm berbunyi selama halaman aplikasi terbuka. Setelah memuat ulang halaman, klik sekali di halaman
          atau tombol Tes/Coba bunyi alarm agar browser mengizinkan suara.
        </p>
      </div>

      <p className="text-xs text-muted">
        Untuk peringatan resmi 24 jam, gunakan aplikasi Info BMKG atau kanal resmi BMKG. Alarm ini bukan sirine
        evakuasi dan aplikasi ini bukan sistem peringatan dini.
      </p>
    </div>
  );
}

export function NotificationSummary() {
  const {
    ready, supported, permission, enabled, alarmSupported, alarmEnabled, alarmSound, scope,
    area, provinceId,
  } = useNotifications();
  const minMag = ALERT_MIN_MAGNITUDE.toFixed(1).replace('.', ',');
  const selectedSound = ALARM_SOUNDS.find((sound) => sound.id === alarmSound) ?? ALARM_SOUNDS[0];
  const selectedProvince = provinceById(provinceId);
  const areaText = area === 'province'
    ? selectedProvince?.name ?? 'provinsi belum dipilih'
    : 'seluruh Indonesia';
  const status = !ready
    ? 'Memeriksa notifikasi…'
    : !supported
      ? 'Tidak didukung browser ini'
      : permission === 'denied'
        ? 'Izin notifikasi ditolak'
        : enabled ? 'Aktif di browser ini' : 'Belum diaktifkan';
  const tone = ready && (!supported || permission === 'denied')
    ? 'text-danger'
    : enabled ? 'text-ok' : 'text-muted';

  return (
    <div className="space-y-2.5 text-sm">
      <div className="flex items-start gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${enabled ? 'bg-ok/10 text-ok' : 'bg-line/60 text-muted'}`}>
          {enabled ? <Bell size={16} aria-hidden /> : <BellOff size={16} aria-hidden />}
        </span>
        <div className="min-w-0">
          <p className={`font-medium ${tone}`}>{status}</p>
          <p className="mt-0.5 text-xs text-muted">
            {!ready
              ? 'Memeriksa dukungan dan izin di browser ini.'
              : !supported
                ? 'Gunakan browser yang mendukung Notifikasi Web lewat HTTPS.'
                : permission === 'denied'
                  ? 'Buka pengaturan situs di browser untuk mengizinkan Notifikasi.'
                  : enabled
                    ? `Cakupan: ${scope === 'all' ? 'semua gempa baru' : `gempa penting (M≥${minMag} atau dirasakan)`} · Area: ${areaText} · Alarm: ${alarmEnabled && alarmSupported ? selectedSound.label : 'nonaktif'}.`
                    : 'Atur izin, cakupan, area, dan bunyi alarm di halaman Pengaturan.'}
          </p>
        </div>
      </div>
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent underline">
        <Settings size={14} aria-hidden /> Buka pengaturan
      </Link>
    </div>
  );
}

export function NotificationToggle() {
  const { ready, supported, enabled, permission, enable, disable } = useNotifications();
  if (!ready || !supported) return null;

  if (permission === 'denied') {
    return (
      <Link
        href="/settings"
        title="Izin notifikasi ditolak. Buka pengaturan."
        aria-label="Izin notifikasi ditolak. Buka pengaturan."
        className="rounded p-2 text-danger hover:bg-line/50"
      >
        <BellOff size={18} aria-hidden />
      </Link>
    );
  }

  const label = enabled ? 'Matikan notifikasi & alarm gempa' : 'Aktifkan notifikasi & alarm gempa';

  return (
    <button
      onClick={() => { if (enabled) disable(); else void enable(); }}
      aria-pressed={enabled}
      title={label}
      aria-label={label}
      className={`rounded p-2 hover:bg-line/50 ${enabled ? 'text-accent' : 'text-muted hover:text-ink'}`}
    >
      {enabled ? <Bell size={18} aria-hidden /> : <BellOff size={18} aria-hidden />}
    </button>
  );
}
