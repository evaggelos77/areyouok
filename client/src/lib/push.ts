import { apiFetch } from './api';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function ensurePushSubscribed() {
  if (!('serviceWorker' in navigator)) return { ok: false, reason: 'no-sw' };
  if (!('PushManager' in window)) return { ok: false, reason: 'no-push' };

  const cfg = await apiFetch<{ pushConfigured: boolean; vapidPublicKey: string | null }>('/api/push/config', {
    method: 'GET'
  });

  if (!cfg.pushConfigured || !cfg.vapidPublicKey) return { ok: false, reason: 'not-configured' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'permission' };

  const reg = await navigator.serviceWorker.ready;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.vapidPublicKey)
    }));

  await apiFetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(sub)
  });

  return { ok: true };
}
