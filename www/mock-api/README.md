# Mock API

Dependency-free mock of the MC Tracker API for viewing the web UI with realistic
data. Plain `node:http`, ESM, Node 20+. No backend, database, or network calls.

```bash
node www/mock-api/server.mjs            # http://localhost:3000
PORT=4000 node www/mock-api/server.mjs  # custom port
```

Point the UI at it (the client base URL is `VITE_MC_TRACKER_API_URL`):

```bash
VITE_MC_TRACKER_API_URL=http://localhost:3000 bun run dev
```

Data lives in memory and resets on restart: 40 servers, 8 ASNs, seeded pins,
suggestions, chat sessions. Time series are deterministic (daily sine + seeded
smooth noise) for any `from`/`to` range, with the same step policy as the real
backend (15s … 30d, max 800 points). Auth defaults to a signed-in non-admin
`demo@mctracker.local`; logout sets `mc_mock_auth=0` and login restores it.
CORS reflects the request `Origin`, allows credentials and `Content-Type`, and
answers preflights with 204. Unknown routes return 404 `{ "code": "notFound",
"message": "Not found" }`.

## Endpoints

```text
GET    /health
GET    /settings/public
GET    /servers?search=&sort=players|name&order=asc|desc&platform=PC|PE
GET    /servers/search?search=&limit=
GET    /servers/compare/timeseries?ids=&from=&to=
GET    /servers/timeseries/total?from=&to=
GET    /servers/timeseries/per-server?from=&to=
GET    /servers/{id}
GET    /servers/{id}/timeseries?from=&to=&dailyAvg=&weeklyAvg=
GET    /asns?search=&sort=players|servers|name&order=
GET    /asns/{asn}?asnOrg=
GET    /asns/timeseries?asn=&asnOrg=&from=&to=
GET    /pinned-servers
POST   /pinned-servers                       { serverId }
PUT    /pinned-servers/order                 { serverIds }
DELETE /pinned-servers/{serverId}
POST   /server-suggestions                   { name, host, port, type }
GET    /server-suggestions/mine
GET    /chat/sessions
GET    /chat/sessions/{sessionId}
DELETE /chat/sessions/{sessionId}
POST   /chat                                 SSE stream (text/event-stream)
POST   /auth/login                           { username, password }
POST   /auth/signup                          { email, password, displayName }
POST   /auth/logout
GET    /auth/me
PATCH  /auth/profile                         { email, displayName }
PATCH  /auth/password                        { currentPassword, newPassword }
DELETE /auth/account                         { password }
GET    /admin/servers
POST   /admin/servers                        { name, host, port, type }
PATCH  /admin/servers/{id}                   partial server + { paused }
DELETE /admin/servers/{id}
GET    /admin/settings
PATCH  /admin/settings/{key}                 { value }
GET    /admin/users
PATCH  /admin/users/{id}/flags               { flags }
GET    /admin/server-suggestions?status=pending|approved|denied
POST   /admin/server-suggestions/{id}/approve
POST   /admin/server-suggestions/{id}/deny
DELETE /admin/server-suggestions/{id}
```

Note: the TS response types expose no `version`, `motd`, or ASN `country`
fields, but the mock includes them as extra realism fields on server/ASN
payloads. Required fields match `www/src/lib/api/*.ts` exactly.
