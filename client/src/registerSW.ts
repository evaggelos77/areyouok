export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');

    // optional: update on reload
    reg.update().catch(() => undefined);
  } catch (e) {
    // ignore
  }
}
