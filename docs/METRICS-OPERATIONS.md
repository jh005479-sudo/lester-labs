# Optional usage measurement

Usage sharing defaults to off. Users can change it on `/setup` or
`/transactions`. Only a random browser ID, session ID, event ID, fixed action,
fixed tool name, and development/browser flag are accepted. No wallet address,
transaction hash, form values, or full URL is collected. These are client-reported
signals, not authenticated people or proof of on-chain adoption.

The application uses the existing persistent LiteForge explorer archive for
activity discovery. Its shared gateway validates record identity and page cursors, publishes coverage
and freshness, and caches responses. Archive records are discovery data, not
independent receipt proofs. Transaction reconciliation and certificate verification
check the live chain separately. The
archive may omit historical records; it is not claimed to be a complete index.

## Hosted storage still needed

The current Vercel application has no configured durable usage store. Never put
a live SQLite database on Vercel's ephemeral function filesystem. The bundled
dependency-free service in `services/metrics/` can run under the approved Node
runtime on an existing private host with persistent storage, behind an HTTPS
reverse proxy. An existing managed ingest service can instead implement the same
small event schema and 30-day retention contract.

Configure these server-only values in the approved hosting environment:

- `LESTER_METRICS_INGEST_URL`: the HTTPS `/events` endpoint; no query or credentials in the URL.
- `LESTER_METRICS_INGEST_TOKEN`: a dedicated random secret, never committed.

The standalone service also requires `LESTER_METRICS_DIRECTORY`, an absolute
private directory with mode `0700`, outside the app's public directory. It binds
only to `127.0.0.1:8788`; `LESTER_METRICS_PORT` may choose another unprivileged
port. Start using `node services/metrics/server.mjs` under a process manager.
Give it no production wallet, signing, SSH, or cloud credentials. Restrict proxy
request size/rate and network access to the approved application. Store backups
privately and expire them within the same retention period.

`GET /report` uses the same bearer authorization and returns aggregate counts,
not browser IDs. It reports events, participating browsers and sessions by tool,
completed sessions, and browsers active on multiple days in the last seven days.
Records expire after 30 days; development events are excluded. The store caps at
200,000 events and fails closed when full. Rate limits in the app are process
local; configure a shared limit at the proxy for deployment.

When no sink is configured, the UI disables opt-in and the API returns
unavailable. No usage event is silently represented as stored.
