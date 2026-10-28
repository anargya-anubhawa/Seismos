import type { Metadata } from 'next';
import { WeatherAlertsPage } from '@/components/weather/WeatherAlertsPage';

export const metadata: Metadata = {
  title: 'Peringatan Dini Cuaca Ekstrem',
  description: 'Peringatan dini cuaca ekstrem resmi BMKG: hujan lebat, petir, angin kencang, wilayah terdampak, dan imbauan keselamatan.',
};

export default function PeringatanDiniCuacaPage() {
  return <WeatherAlertsPage />;
}
