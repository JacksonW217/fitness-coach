import { describe, expect, it } from 'vitest';
import { configStatus, originOf, parseRequest, validSubscription } from './_shared';

const sub = { endpoint: 'https://web.push.apple.com/QGuQyavXutnMH', keys: { p256dh: 'BNcRdreALRFX', auth: 'tBHItJI5svbpez7KI4CCXg' } };
const NOW = Date.parse('2026-11-23T12:00:00Z');
const base = { action: 'schedule', at: '2026-11-23T12:01:30Z', subscription: sub, title: 'Rest’s over', body: 'Bench press · set 2 of 3', tag: 'rest' };

describe('rest-timer request checks', () => {
  it('accepts a normal schedule and cancel', () => {
    const r = parseRequest(base, NOW);
    expect(typeof r).toBe('object');
    expect((r as { at: string }).at).toBe('2026-11-23T12:01:30.000Z');
    expect(parseRequest({ action: 'cancel', id: 'msg_123' }, NOW)).toEqual({ action: 'cancel', id: 'msg_123' });
  });

  it('only sends to real push services over https', () => {
    expect(validSubscription(sub)).toBe(true);
    expect(validSubscription({ ...sub, endpoint: 'https://fcm.googleapis.com/fcm/send/abc' })).toBe(true);
    expect(validSubscription({ ...sub, endpoint: 'https://evil.example.com/x' })).toBe(false);
    expect(validSubscription({ ...sub, endpoint: 'http://web.push.apple.com/x' })).toBe(false);
    expect(validSubscription({ ...sub, endpoint: 'https://web.push.apple.com.evil.com/x' })).toBe(false);
    expect(validSubscription({ endpoint: sub.endpoint })).toBe(false);
  });

  it('rejects bad times, text and actions', () => {
    expect(parseRequest({ ...base, at: 'soon' }, NOW)).toBe('Invalid time.');
    expect(parseRequest({ ...base, at: '2026-11-23T13:00:00Z' }, NOW)).toBe('Time is out of range.');
    expect(parseRequest({ ...base, at: '2026-11-23T11:00:00Z' }, NOW)).toBe('Time is out of range.');
    expect(parseRequest({ ...base, title: '' }, NOW)).toBe('Invalid notification text.');
    expect(parseRequest({ ...base, title: 'x'.repeat(500) }, NOW)).toBe('Invalid notification text.');
    expect(parseRequest({ action: 'nuke' }, NOW)).toBe('Unknown action.');
    expect(parseRequest({ action: 'cancel' }, NOW)).toBe('Missing message id.');
    expect(parseRequest(null, NOW)).toBe('Expected a JSON body.');
  });

  it('reports setup without revealing values', () => {
    expect(configStatus({})).toEqual({ vapid: false, qstashToken: false, signingKeys: false });
    expect(configStatus({ VAPID_PRIVATE_KEY: 'k', QSTASH_TOKEN: 't', QSTASH_CURRENT_SIGNING_KEY: 'a', QSTASH_NEXT_SIGNING_KEY: 'b' })).toEqual({ vapid: true, qstashToken: true, signingKeys: true });
    expect(configStatus({ QSTASH_CURRENT_SIGNING_KEY: 'a' }).signingKeys).toBe(false);
  });

  it('builds the public origin from headers', () => {
    expect(originOf(new Headers({ host: 'forge.vercel.app' }))).toBe('https://forge.vercel.app');
    expect(originOf(new Headers({ 'x-forwarded-host': 'a.app, b.app', host: 'internal' }))).toBe('https://a.app');
  });
});
