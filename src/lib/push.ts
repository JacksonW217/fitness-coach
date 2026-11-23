/**
 * Rest-timer notifications.
 *
 * When the phone is locked, the app is frozen and can't run a timer, so the
 * app asks the server (/api/rest-timer) to send a push notification when the
 * rest ends. Each new or changed timer replaces the previous alert.
 */
import { VAPID_PUBLIC_KEY } from '../../api/_shared';

const ENABLED = 'forge.push.enabled';
const PENDING = 'forge.push.pending';

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
};

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iPhones only allow notifications for apps opened from the Home Screen. */
export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const permission = (): NotificationPermission | 'unsupported' => (pushSupported() ? Notification.permission : 'unsupported');

export const pushEnabled = () => ls.get(ENABLED) === '1' && permission() === 'granted';

function keyBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const b = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function subscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/**
 * Ask for permission and subscribe. Must be called straight from a tap: iOS
 * only shows the permission prompt in response to one.
 */
export async function enablePush(): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!pushSupported()) {
    return { ok: false, reason: isStandalone() ? 'This phone doesn’t support web notifications. iOS 16.4 or newer is needed.' : 'Open Forge from its Home Screen icon first. iPhones only allow notifications for apps added to the Home Screen.' };
  }
  const result = await Notification.requestPermission();
  if (result !== 'granted') {
    return { ok: false, reason: result === 'denied' ? 'Notifications are blocked for Forge. Turn them on in the iPhone Settings app → Notifications → Forge.' : 'Permission wasn’t given.' };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (!existing) await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource });
    ls.set(ENABLED, '1');
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `Couldn’t set up notifications: ${(e as Error).message}` };
  }
}

export async function disablePush() {
  await cancelRestAlert();
  ls.set(ENABLED, null);
  try {
    await (await subscription())?.unsubscribe();
  } catch {
    /* already gone */
  }
}

/** Whether the server has its keys set (booleans only). */
export async function serverStatus(): Promise<{ ready: boolean; missing: string[] } | null> {
  try {
    const r = await fetch('/api/rest-timer', { cache: 'no-store' });
    if (!r.ok) return null;
    const { config } = (await r.json()) as { config: { vapid: boolean; qstashToken: boolean; signingKeys: boolean } };
    const missing = [!config.vapid && 'VAPID_PRIVATE_KEY', !config.qstashToken && 'QSTASH_TOKEN', !config.signingKeys && 'QSTASH signing keys'].filter(Boolean) as string[];
    return { ready: missing.length === 0, missing };
  } catch {
    return null;
  }
}

async function post(body: unknown): Promise<{ id?: string; error?: string }> {
  const r = await fetch('/api/rest-timer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!r.ok) return { error: data.error ?? `Server error ${r.status}` };
  return data;
}

// Calls are chained so a quick "+30s, +30s" can't leave two alerts scheduled.
let chain: Promise<unknown> = Promise.resolve();
const queue = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
};

interface Pending {
  id: string;
  at: string;
}
const pending = (): Pending | null => {
  try {
    return JSON.parse(ls.get(PENDING) ?? 'null');
  } catch {
    return null;
  }
};

/** A one-off test notification, separate from the rest timer's alert. */
export async function sendTestAlert(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!pushEnabled()) return { ok: false, error: 'Turn alerts on first.' };
  const sub = await subscription();
  if (!sub) return { ok: false, error: 'Not subscribed.' };
  const res = await post({
    action: 'schedule',
    at: new Date(Date.now() + 10_000).toISOString(),
    subscription: sub.toJSON(),
    title: 'Test: rest’s over',
    body: 'If you can see this, rest alerts work.',
    tag: 'forge-test',
  }).catch((e: Error) => ({ error: e.message, id: undefined }));
  return res.id ? { ok: true } : { ok: false, error: res.error ?? 'Unknown error' };
}

/** Cancel the scheduled alert, if any. */
export const cancelRestAlert = () =>
  queue(async () => {
    const p = pending();
    if (!p) return;
    ls.set(PENDING, null);
    await post({ action: 'cancel', id: p.id }).catch(() => undefined);
  });

/**
 * Make sure exactly one alert is scheduled, for `at`. Does nothing if
 * notifications are off or the same time is already scheduled.
 */
export const scheduleRestAlert = (at: string, title: string, body: string) =>
  queue(async () => {
    if (!pushEnabled()) return { ok: false as const, error: 'off' };
    const p = pending();
    if (p?.at === at) return { ok: true as const };
    if (p) {
      ls.set(PENDING, null);
      await post({ action: 'cancel', id: p.id }).catch(() => undefined);
    }
    if (Date.parse(at) <= Date.now() + 1000) return { ok: false as const, error: 'past' };
    const sub = await subscription();
    if (!sub) return { ok: false as const, error: 'Not subscribed.' };
    const res = await post({ action: 'schedule', at, subscription: sub.toJSON(), title, body, tag: 'forge-rest' }).catch((e: Error) => ({ error: e.message, id: undefined }));
    if (res.id) ls.set(PENDING, JSON.stringify({ id: res.id, at }));
    return res.id ? { ok: true as const } : { ok: false as const, error: res.error ?? 'Unknown error' };
  });
