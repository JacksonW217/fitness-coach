import { describe, expect, it, vi } from 'vitest';
import * as realWebPush from 'web-push';

const calls: { url: string; headers: Record<string, string>; bytes: number }[] = [];
vi.mock('web-push', async (orig) => {
  const real = (await orig()) as typeof import('web-push');
  return {
    ...real,
    sendNotification: vi.fn(async (s: unknown, payload: string, opts: Record<string, unknown>) => {
      const d = real.generateRequestDetails(s as never, payload, opts as never);
      calls.push({ url: d.endpoint, headers: d.headers as Record<string, string>, bytes: (d.body as Buffer).length });
      return { statusCode: 201, body: '', headers: {} };
    }),
  };
});

describe('api functions (no network)', () => {
  it('rest-timer GET reports setup and POST refuses until configured', async () => {
    vi.resetModules();
    for (const k of ['VAPID_PRIVATE_KEY', 'QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY']) delete process.env[k];
    const m = await import('./rest-timer');
    const g = await (await m.GET()).json();
    expect(g.config).toEqual({ vapid: false, qstashToken: false, signingKeys: false });
    const r = await m.POST(new Request('https://x.app/api/rest-timer', { method: 'POST', body: '{}' }));
    expect(r.status).toBe(503);
  });

  it('rest-timer POST validates before calling QStash', async () => {
    Object.assign(process.env, { VAPID_PRIVATE_KEY: 'k', QSTASH_TOKEN: 't', QSTASH_CURRENT_SIGNING_KEY: 'a', QSTASH_NEXT_SIGNING_KEY: 'b' });
    const m = await import('./rest-timer');
    expect((await m.POST(new Request('https://x.app/api/rest-timer', { method: 'POST', body: 'nope' }))).status).toBe(400);
    const bad = await m.POST(new Request('https://x.app/api/rest-timer', { method: 'POST', body: JSON.stringify({ action: 'schedule', subscription: { endpoint: 'https://evil.com', keys: { p256dh: 'a', auth: 'b' } } }) }));
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe('Invalid push subscription.');
  });

  it('send-push rejects unsigned requests', async () => {
    const m = await import('./send-push');
    const r = await m.POST(new Request('https://x.app/api/send-push', { method: 'POST', headers: { host: 'x.app' }, body: '{"title":"x"}' }));
    expect(r.status).toBe(401);
    const forged = await m.POST(new Request('https://x.app/api/send-push', { method: 'POST', headers: { host: 'x.app', 'upstash-signature': 'eyJhbGciOiJIUzI1NiJ9.e30.abc' }, body: '{}' }));
    expect(forged.status).toBe(401);
  });

  it('send-push signs and sends a real encrypted push when the signature is valid', async () => {
    const { SignJWT } = await import('jose');
    const { createHash } = await import('node:crypto');
    const keys = realWebPush.generateVAPIDKeys();
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'sig_current_test';
    process.env.QSTASH_NEXT_SIGNING_KEY = 'sig_next_test';
    // A browser-style subscription (P-256 public key + 16-byte auth secret).
    const ecdh = (await import('node:crypto')).createECDH('prime256v1');
    ecdh.generateKeys();
    const sub = { endpoint: 'https://web.push.apple.com/test-endpoint', keys: { p256dh: ecdh.getPublicKey('base64url'), auth: Buffer.alloc(16, 7).toString('base64url') } };
    const body = JSON.stringify({ subscription: sub, title: 'Rest’s over', body: 'Next: Bench', tag: 'forge-rest' });
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({ body: createHash('sha256').update(body).digest('base64url') })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuer('Upstash').setSubject('https://x.app/api/send-push')
      .setIssuedAt(now).setNotBefore(now).setExpirationTime(now + 300).setJti('j1').sign(new TextEncoder().encode('sig_current_test'));
    const m = await import('./send-push');
    const r = await m.POST(new Request('https://x.app/api/send-push', { method: 'POST', headers: { host: 'x.app', 'upstash-signature': jwt }, body }));
    expect(r.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(sub.endpoint);
    expect(calls[0].headers['Content-Encoding']).toBe('aes128gcm');
    expect(calls[0].headers.Urgency).toBe('high');
    expect(calls[0].bytes).toBeGreaterThan(50);
    expect(calls[0].headers.Authorization).toMatch(/^vapid t=.+, k=BA0l4IP/);
  });
});
