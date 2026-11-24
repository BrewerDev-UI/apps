import type { Weather } from './sim';

export interface LocalWeather {
  kind: Weather;
  label: string;
}

// Asks the phone where it is, then asks Open-Meteo for the weather there.
// The location is rounded to about 7 miles before it is sent, and nothing is stored.
export function localWeather(): Promise<LocalWeather> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('No location on this device.'));
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude.toFixed(1);
          const lon = pos.coords.longitude.toFixed(1);
          const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
            '&current=temperature_2m,precipitation,weather_code&temperature_unit=fahrenheit';
          const res = await fetch(url);
          if (!res.ok) throw new Error('Weather service did not answer.');
          const j = await res.json();
          const temp = Math.round(j.current.temperature_2m);
          const code = j.current.weather_code as number;
          const wet = j.current.precipitation > 0 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
          const snowy = (code >= 71 && code <= 77) || code === 85 || code === 86;
          const kind: Weather = snowy || temp <= 34 ? 'frost' : wet ? 'rain' : 'clear';
          const word = kind === 'frost' ? 'Frost' : kind === 'rain' ? 'Rain' : 'Clear';
          resolve({ kind, label: `${word} · ${temp}°F` });
        } catch (e) {
          reject(e instanceof Error ? e : new Error('Weather failed.'));
        }
      },
      () => reject(new Error('Location was not allowed.')),
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 },
    );
  });
}
