type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type PwaState = {
  canInstall: boolean;
  installed: boolean;
};

let isInitialized = false;
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let pwaState: PwaState = {
  canInstall: false,
  installed: false,
};

const listeners = new Set<(state: PwaState) => void>();

function detectInstalled() {
  if (typeof window === 'undefined') return false;

  const standaloneMedia = window.matchMedia?.('(display-mode: standalone)').matches;
  const navigatorStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  );

  return standaloneMedia || navigatorStandalone;
}

function emit() {
  listeners.forEach((listener) => listener({ ...pwaState }));
}

export function initializePwaInstallTracking() {
  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  pwaState = {
    ...pwaState,
    installed: detectInstalled(),
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    pwaState = {
      canInstall: true,
      installed: detectInstalled(),
    };
    emit();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    pwaState = {
      canInstall: false,
      installed: true,
    };
    emit();
  });

  emit();
}

export function getPwaInstallState() {
  return { ...pwaState };
}

export function subscribeToPwaInstallState(listener: (state: PwaState) => void) {
  listeners.add(listener);
  listener({ ...pwaState });

  return () => {
    listeners.delete(listener);
  };
}

export async function promptInstall() {
  if (!deferredPrompt) return false;

  const promptEvent = deferredPrompt;
  await promptEvent.prompt();
  const result = await promptEvent.userChoice;

  if (result.outcome !== 'accepted') {
    return false;
  }

  deferredPrompt = null;
  pwaState = {
    canInstall: false,
    installed: detectInstalled(),
  };
  emit();
  return true;
}
