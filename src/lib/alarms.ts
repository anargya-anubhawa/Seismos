export const ALARM_SOUNDS = [
  {
    id: 'tri-tone',
    label: 'Tiga nada',
    description: 'Nada pendek berulang dengan pola tiga nada. Paling jelas untuk peringatan.',
  },
  {
    id: 'chime',
    label: 'Lonceng lembut',
    description: 'Nada sinusoidal yang lebih lembut dan tidak terlalu mendesak.',
  },
  {
    id: 'siren',
    label: 'Sirine naik-turun',
    description: 'Nada bergelombang. Bukan sirene evakuasi resmi.',
  },
  {
    id: 'pulse',
    label: 'Denyut singkat',
    description: 'Beep pendek berulang, cocok bila tidak ingin suara panjang.',
  },
] as const;

export type AlarmSoundId = (typeof ALARM_SOUNDS)[number]['id'];

export const DEFAULT_ALARM_SOUND: AlarmSoundId = 'tri-tone';
export const DEFAULT_ALARM_VOLUME = 20;

export const isAlarmSoundId = (value: string | null): value is AlarmSoundId =>
  value !== null && ALARM_SOUNDS.some((sound) => sound.id === value);
