/**
 * Browser system notifications via the Notification API and (when available)
 * ServiceWorkerRegistration.showNotification — works more reliably when the tab is in the background.
 *
 * Do not call requestPermission from timers or fetch callbacks: pass allowPermissionPrompt: false
 * (default) and use a header button with ensureDesktopNotificationPermission() on click.
 */

const SW_NOTIFY_PATH = '/sw-notify.js';

export type DesktopNotificationOptions = {
  title: string;
  body?: string;
  /** Dedupes / replaces previous notification with the same tag in some browsers */
  tag?: string;
  icon?: string;
  /** Invoked when permission is denied, API unsupported, or show throws */
  fallback?: () => void;
  /**
   * Only true from a direct user gesture (e.g. button click). Background polling must leave false
   * so the browser can show the permission prompt and granted state works predictably.
   */
  allowPermissionPrompt?: boolean;
};

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Registers the tiny notification SW (safe to call multiple times).
 */
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SW_NOTIFY_PATH, { scope: '/' });
  } catch {
    return null;
  }
}

/**
 * Current permission without prompting. 'default' | 'granted' | 'denied' | unsupported
 */
export function getDesktopNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Call from a user gesture (e.g. click) to show the browser permission prompt when still "default".
 */
export async function ensureDesktopNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isSupported()) return 'unsupported';
  try {
    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

async function showViaServiceWorkerOrWindow(
  title: string,
  opts: NotificationOptions
): Promise<boolean> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register(SW_NOTIFY_PATH, { scope: '/' });
      }
      await navigator.serviceWorker.ready;
      reg = (await navigator.serviceWorker.getRegistration()) ?? reg;
      if (reg) {
        await reg.showNotification(title, opts);
        return true;
      }
    } catch {
      /* fall through */
    }
  }
  try {
    const n = new Notification(title, opts);
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Shows a system notification when permitted; otherwise runs fallback.
 */
export async function showDesktopNotification(options: DesktopNotificationOptions): Promise<void> {
  const { title, body, tag, icon, fallback, allowPermissionPrompt = false } = options;

  if (!isSupported()) {
    fallback?.();
    return;
  }

  try {
    let permission = Notification.permission;

    if (permission === 'default') {
      if (!allowPermissionPrompt) {
        fallback?.();
        return;
      }
      permission = await Notification.requestPermission();
    }

    if (permission === 'denied' || permission !== 'granted') {
      fallback?.();
      return;
    }

    const opts: NotificationOptions = {
      body: body || undefined,
      tag,
      icon: icon || undefined,
    };

    const ok = await showViaServiceWorkerOrWindow(title, opts);
    if (!ok) fallback?.();
  } catch {
    fallback?.();
  }
}
