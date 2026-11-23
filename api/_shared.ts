/**
 * Shared, dependency-free helpers for the rest-timer notification functions.
 * Files starting with "_" in /api are not deployed as functions by Vercel.
 */

/** The public half of the VAPID key pair. The private half is the VAPID_PRIVATE_KEY env var. */
export const VAPID_PUBLIC_KEY = 'BA0l4IP_ivb7iXg6FhN4IA3lAUE9RUcNsjhG78u1D-nhrryy_FYHkNLFK8RmPOxlzUv0rXtXc2Hlt5BgNhMZNT4';

/** Push services browsers use. Anything else is refused, so the endpoint can't be used to call arbitrary URLs. */
const PUSH_HOSTS = [/^web\.push\.apple\.com$/, /(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Alert {
  title: string;
  body: string;
  tag: string;
}

export interface ScheduleRequest extends Alert {
  action: 'schedule';
  /** When to deliver, as an ISO timestamp. */
  at: string;
  subscription: PushSubscriptionJSON;
}

export interface CancelRequest {
  action: 'cancel';
  id: string;
}

const str = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max;

export function validSubscription(s: unknown): s is PushSubscriptionJSON {
  const x = s as PushSubscriptionJSON;
  if (!x || !str(x.endpoint, 2048) || !x.keys || !str(x.keys.p256dh, 256) || !str(x.keys.auth, 128)) return false;
  try {
    const u = new URL(x.endpoint);
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/** Longest rest the server will schedule. Real rests are a few minutes. */
export const MAX_DELAY_SEC = 20 * 60;

/** Check a request body. Returns the parsed request, or an error message. */
export function parseRequest(body: unknown, now = Date.now()): ScheduleRequest | CancelRequest | string {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== 'object') return 'Expected a JSON body.';
  if (b.action === 'cancel') return str(b.id, 200) ? { action: 'cancel', id: b.id as string } : 'Missing message id.';
  if (b.action !== 'schedule') return 'Unknown action.';
  if (!validSubscription(b.subscription)) return 'Invalid push subscription.';
  if (!str(b.title, 120) || !str(b.body, 300) || !str(b.tag, 60)) return 'Invalid notification text.';
  const at = Date.parse(String(b.at));
  if (!Number.isFinite(at)) return 'Invalid time.';
  const delay = (at - now) / 1000;
  if (delay < -5 || delay > MAX_DELAY_SEC) return 'Time is out of range.';
  return { action: 'schedule', at: new Date(at).toISOString(), subscription: b.subscription as PushSubscriptionJSON, title: b.title as string, body: b.body as string, tag: b.tag as string };
}

/** Public origin of the deployment, from the request's host header. */
export function originOf(headers: Headers): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? '';
  return `https://${host.split(',')[0].trim()}`;
}

/** Which settings are present, without revealing any values. */
export function configStatus(env: Record<string, string | undefined>) {
  const has = (k: string) => !!env[k]?.trim();
  return {
    vapid: has('VAPID_PRIVATE_KEY'),
    qstashToken: has('QSTASH_TOKEN'),
    signingKeys: has('QSTASH_CURRENT_SIGNING_KEY') && has('QSTASH_NEXT_SIGNING_KEY'),
  };
}

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
