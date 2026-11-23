import { useEffect, useState } from 'react';
import { disablePush, enablePush, isStandalone, permission, pushEnabled, pushSupported, sendTestAlert, serverStatus } from '../lib/push';
import { Toggle } from './ui';

/** Profile card: turn lock-screen rest alerts on or off, check setup, and send a test. */
export function RestAlerts() {
  const [on, setOn] = useState(pushEnabled());
  const [server, setServer] = useState<Awaited<ReturnType<typeof serverStatus>> | 'loading'>('loading');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void serverStatus().then(setServer);
  }, []);

  const toggle = async () => {
    setMsg(null);
    if (on) {
      await disablePush();
      setOn(false);
      return;
    }
    setBusy(true);
    const r = await enablePush(); // must run straight from the tap
    setBusy(false);
    if (r.ok) setOn(true);
    else setMsg(r.reason);
  };

  const test = async () => {
    setMsg(null);
    setBusy(true);
    const r = await sendTestAlert();
    setBusy(false);
    setMsg(r.ok ? 'Test scheduled for 10 seconds from now. Lock your phone to see it on the lock screen.' : `Test failed: ${r.error}`);
  };

  const supported = pushSupported();
  const denied = permission() === 'denied';
  const serverLine =
    server === 'loading'
      ? 'Checking the notification server…'
      : server === null
        ? 'Couldn’t reach the notification server. Check your internet connection.'
        : server.ready
          ? 'Notification server is set up.'
          : `Notification server isn’t set up yet (missing: ${server.missing.join(', ')}). See the setup steps.`;

  return (
    <div className="card stack">
      <div className="row between">
        <div>
          <div style={{ fontWeight: 600 }}>Lock-screen rest alerts</div>
          <div className="foot">A notification when your rest timer ends, even with the phone locked. Needs internet.</div>
        </div>
        <Toggle on={on} onChange={() => void toggle()} label="Lock-screen rest alerts" />
      </div>
      {!supported && <p className="foot" style={{ margin: 0 }}>{isStandalone() ? 'This phone doesn’t support web notifications (iOS 16.4 or newer is needed).' : 'Open Forge from its Home Screen icon to turn these on. iPhones only allow notifications for Home Screen apps.'}</p>}
      {denied && <p className="foot" style={{ margin: 0 }}>Notifications are blocked. Turn them on in the iPhone Settings app → Notifications → Forge, then come back.</p>}
      <p className="foot" style={{ margin: 0 }}>{serverLine}</p>
      {on && (
        <button className="btn secondary" disabled={busy} onClick={() => void test()}>
          Send a test alert
        </button>
      )}
      {msg && <p className="sub" style={{ margin: 0 }} role="status">{msg}</p>}
    </div>
  );
}
