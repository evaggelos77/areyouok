export type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let initialized = false;
let deferredPrompt: DeferredInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  const navAny = navigator as any;
  return window.matchMedia('(display-mode: standalone)').matches || navAny.standalone === true;
}

export function isAppleMobile() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const iOS = /iphone|ipad|ipod/.test(ua);
  const iPadOSDesktopUA = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOS || iPadOSDesktopUA;
}

export function initInstallPromptCapture() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    const promptEvent = event as DeferredInstallPromptEvent;
    promptEvent.preventDefault?.();
    deferredPrompt = promptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null;
  notify();
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
