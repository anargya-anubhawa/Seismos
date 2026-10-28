import type { Metadata } from 'next';
import { WeatherForecastPage } from '@/components/weather/WeatherForecastPage';

export const metadata: Metadata = {
  title: 'Prakiraan Cuaca',
  description: 'Prakiraan cuaca desa/kelurahan resmi BMKG: suhu, kelembapan, angin, dan curah hujan per interval tiga jam untuk tiga hari, sesuai lokasi perangkat atau wilayah pilihan.',
};

export default function CuacaPage() {
  return <WeatherForecastPage />;
}
