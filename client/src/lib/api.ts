export type ApiError = {
  error: string;
  message?: string;
  [k: string]: unknown;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = (data as any) || { error: 'REQUEST_FAILED' };
    throw err as ApiError;
  }

  return data as T;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function getBatteryLevel(): Promise<number | null> {
  // Battery Status API isn't supported everywhere
  // @ts-ignore
  const navAny = navigator as any;
  if (!navAny.getBattery) return null;
  try {
    // @ts-ignore
    const b = await navAny.getBattery();
    if (typeof b.level === 'number') return Math.round(b.level * 100) / 100;
    return null;
  } catch {
    return null;
  }
}

export async function getCurrentPosition(timeoutMs = 8000): Promise<
  | { lat: number; lng: number; accuracy: number | null }
  | null
> {
  if (!('geolocation' in navigator)) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 5000
      }
    );
  });
}
