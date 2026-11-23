/**
 * Schedules (or cancels) a rest-timer notification.
 *
 * The phone can't run a timer while it's locked, so the app asks this function
 * to deliver a push notification at the end of the rest. QStash (Upstash's
 * free message queue) holds the message until then and calls /api/send-push.
 *
 * GET  → which settings are configured (booleans only), for the app's setup screen.
 * POST → { action: 'schedule', at, subscription, title, body, tag } → { id }
 *        { action: 'cancel', id } → { ok: true }
 */
import { Client } from '@upstash/qstash';
import { configStatus, json, originOf, parseRequest } from './_shared';

export async function GET() {
  return json({ ok: true, config: configStatus(process.env) });
}

export async function POST(request: Request) {
  const config = configStatus(process.env);
  if (!config.qstashToken || !config.vapid || !config.signingKeys) return json({ error: 'Notifications are not set up on the server yet.', config }, 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400);
  }
  const req = parseRequest(body);
  if (typeof req === 'string') return json({ error: req }, 400);

  const qstash = new Client({ token: process.env.QSTASH_TOKEN!, enableTelemetry: false });
  try {
    if (req.action === 'cancel') {
      await qstash.messages.cancel(req.id).catch(() => undefined); // already delivered or gone: fine
      return json({ ok: true });
    }
    const { messageId } = await qstash.publishJSON({
      url: `${originOf(request.headers)}/api/send-push`,
      body: { subscription: req.subscription, title: req.title, body: req.body, tag: req.tag },
      notBefore: Math.max(Math.floor(Date.now() / 1000) + 1, Math.floor(Date.parse(req.at) / 1000)),
      retries: 1, // a late "rest's over" is useless, so don't keep retrying
    });
    return json({ id: messageId });
  } catch (e) {
    return json({ error: `Couldn’t reach the scheduling service: ${(e as Error).message}` }, 502);
  }
}
