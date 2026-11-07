import { BackBar, Empty, Page } from '../components/ui';
import { useChanges } from '../lib/data';
import { fmtDate } from '../lib/util';

export default function ProgramHistory() {
  const changes = useChanges();
  return (
    <Page noTabs>
      <BackBar title="Change history" />
      {changes && !changes.length && <Empty title="No changes yet" />}
      <div className="list" style={{ marginTop: 12 }}>
        {changes?.map((c) => (
          <div className="list-row" key={c.id} style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div style={{ fontWeight: 500 }}>{c.summary}</div>
              {c.reason && <div className="foot">{c.reason}</div>}
            </div>
            <div className="foot num" style={{ whiteSpace: 'nowrap' }}>{fmtDate(c.at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
          </div>
        ))}
      </div>
    </Page>
  );
}
