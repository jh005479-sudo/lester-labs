import { DatabaseSync } from 'node:sqlite'
import { parseUsageEvent } from '../../src/lib/usageMetrics.ts'

export function createUsageStore(filename) {
  const db = new DatabaseSync(filename)
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1000; CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, device TEXT NOT NULL, session TEXT NOT NULL, kind TEXT NOT NULL, surface TEXT NOT NULL, traffic TEXT NOT NULL, received_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS events_received ON events(received_at); CREATE INDEX IF NOT EXISTS events_device ON events(device,received_at);')
  const prune = (now) => db.prepare('DELETE FROM events WHERE received_at < ?').run(now - 30 * 86_400_000)
  return {
    insert(value, now = Date.now()) {
      const event = parseUsageEvent(value)
      prune(now)
      if (db.prepare('SELECT count(*) AS count FROM events').get().count >= 200_000) throw new Error('Metrics capacity reached.')
      return db.prepare('INSERT OR IGNORE INTO events(id,device,session,kind,surface,traffic,received_at) VALUES(?,?,?,?,?,?,?)').run(event.id, event.device, event.session, event.kind, event.surface, event.traffic, now).changes
    },
    report(now = Date.now()) {
      prune(now)
      const week = now - 7 * 86_400_000
      return {
        definition: 'Opt-in, client-reported browser activity. Browser IDs are not people. Development traffic is excluded. These figures are not verified on-chain adoption.',
        retentionDays: 30,
        lastSevenDays: db.prepare("SELECT kind,surface,count(*) AS events,count(DISTINCT device) AS browsers,count(DISTINCT session) AS sessions FROM events WHERE received_at>=? AND traffic='browser' GROUP BY kind,surface ORDER BY kind,surface").all(week),
        returningBrowsers: db.prepare("SELECT count(*) AS count FROM (SELECT device FROM events WHERE received_at>=? AND traffic='browser' GROUP BY device HAVING count(DISTINCT CAST(received_at / 86400000 AS INTEGER))>1)").get(week).count,
        completedSessions: db.prepare("SELECT count(DISTINCT session) AS count FROM events WHERE received_at>=? AND kind='transaction_confirmed' AND traffic='browser'").get(week).count,
      }
    },
    close: () => db.close(),
  }
}
