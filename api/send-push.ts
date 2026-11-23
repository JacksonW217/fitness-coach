/**
 * Called by QStash when a rest timer ends. Verifies the request really came
 * from QStash, then sends the push notification to the phone.
 */
import { Receiver } from '@upstash/qstash';
import { sendNotification } from 'web-push';
import { json, originOf, validSubscription, VAPID_PUBLIC_KEY, type Alert, type PushSubscriptionJSON } from './_shared';

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get('upstash-signature') ?? '';
  const origin = originOf(request.headers);
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    devMode: false,
  });
  try {
    const ok = await receiver.verify({ signature, body: raw, url: `${origin}/api/send-push`, clockTolerance: 5 });
    if (!ok) return json({ error: 'Bad signature.' }, 401);
  } catch {
    return json({ error: 'Bad signature.' }, 401);
  }

  const msg = JSON.parse(raw) as Alert & { subscription: PushSubscriptionJSON };
  if (!validSubscription(msg.subscription)) return json({ error: 'Invalid subscription.' }, 400);

  try {
    await sendNotification(msg.subscription, JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag }), {
      TTL: 120,
      urgency: 'high',
      vapidDetails: { subject: origin, publicKey: VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY! },
    });
    return json({ ok: true });
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode ?? 0;
    // 404/410: the phone turned notifications off. Don't retry.
    if (status === 404 || status === 410) return json({ ok: false, gone: true });
    return json({ error: `Push service error ${status || ''}`.trim() }, 502);
  }
}
