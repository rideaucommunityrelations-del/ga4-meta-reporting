# Marketing Command Center

A live reporting dashboard that pulls real GA4, Meta Ads, and Search Console
data directly from their APIs and merges it into one view — with trend
history, period-over-period comparisons, an optional AI-generated summary,
and an emailed digest — replacing manual CSV exports and copy-paste
reporting with a single source of truth.

## Why I built this

Marketing teams routinely burn hours each week pulling numbers from GA4 and
Meta Ads Manager separately, exporting to spreadsheets, and reconciling them
by hand. This project automates that entirely: it authenticates with both
platforms' APIs, fetches a rolling 30-day snapshot, and renders it as a single
dashboard — so the reporting step disappears and the team can go straight to
analysis.

It's built the same way I'd approach it inside a marketing org: as a small,
documented, versioned internal tool rather than a one-off script — something
another marketer (or another developer) could pick up, read, and extend.

## What it does

- Authenticates with the **GA4 Data API** via a service account and pulls:
  sessions, active users, conversions, engagement rate, a 30-day daily trend,
  a prior-period comparison, top channels, top landing pages, device
  breakdown, new vs returning users, and top countries
- Authenticates with the **Meta Marketing API** via a long-lived access token
  and pulls: spend, impressions, clicks, CTR, CPC, frequency, conversions, a
  daily spend trend, a prior-period comparison, a campaign-level breakdown,
  and a top-ads breakdown
- Optionally authenticates with the **Search Console API** (reusing the same
  GA4 service account) and pulls organic clicks, impressions, average
  position, and top queries
- Optionally generates a short **AI summary** of the combined report via the
  Anthropic API — skips gracefully if no API key is configured
- Merges everything into a single `/api/report` endpoint
- Renders it on a dashboard with a boot-sequence animation, comparison
  badges (▲/▼ vs the prior 30 days), and a trend chart
- Caches results for a configurable window (default 15 min) to avoid
  hammering any API on every page refresh
- Can email the same report as a formatted digest (`npm run digest`),
  designed to be scheduled via cron / Task Scheduler

## Architecture

```
server.js                    Express server, serves the dashboard, exposes /api/report and /api/send-digest
lib/build-report.js          Shared logic that fetches + merges all sources — used by both the server and the digest script
services/ga4.js               GA4 Data API client and report shaping
services/meta.js              Meta Marketing API client and report shaping
services/search-console.js    Search Console API client and report shaping
services/summary.js           AI summary generation (Anthropic API)
services/email.js             Digest email formatting and sending
scripts/send-digest.js        Standalone script for scheduled/manual digest sends
public/                        Dashboard frontend (vanilla HTML/CSS/JS)
```

Data flows one direction: browser → `/api/report` → GA4 + Meta + Search
Console APIs (fetched in parallel) → merged JSON → rendered dashboard. No
data is stored outside the in-memory cache.

## Tech stack

Node.js, Express, `@google-analytics/data` (official GA4 client library),
Meta Graph API (Marketing API), `googleapis` (Search Console), Anthropic API
(AI summary), Nodemailer (email digest), vanilla JS frontend — no framework.

## Running it locally

```bash
npm install
cp .env.example .env
# fill in .env with your GA4 property ID + service account path,
# and your Meta access token + ad account ID
npm start
```

Then open `http://localhost:3000`.

## Setup notes

- **GA4**: requires a Google Cloud service account with the GA4 Data API
  enabled, added as a Viewer on the target GA4 property.
- **Search Console** (optional): requires the Search Console API enabled on
  the same Cloud project, and the same service account added as a user on
  the property in Search Console settings. Leave `GSC_SITE_URL` blank in
  `.env` to skip this entirely.
- **Meta**: requires a Meta developer app with the Marketing API product
  added, and a long-lived access token (`ads_read` scope) tied to the ad
  account being reported on.
- **AI summary** (optional): requires an Anthropic API key from
  console.anthropic.com. Leave `ANTHROPIC_API_KEY` blank to skip.
- **Email digest** (optional): requires SMTP credentials (e.g. a Gmail
  address + App Password). Run `npm run digest` manually, or schedule it
  with cron / Task Scheduler for automatic delivery.
- Credentials are never committed — `.env` and `/credentials` are gitignored.
  See `.env.example` for the exact variables needed.

## MCP server

`mcp-server/` exposes the same data layer as MCP tools, so an AI agent (e.g.
Claude Code or Claude Desktop) can query it directly in natural language
instead of through the dashboard UI — "how did paid social do last month?"
instead of opening a browser. It reuses `services/ga4.js`, `services/meta.js`,
`services/search-console.js`, and `lib/build-report.js` directly rather than
duplicating any API logic; the dashboard and the MCP server are two front
ends on one data layer.

Tools exposed: `get_ga4_report`, `get_meta_report`,
`get_search_console_report`, `get_full_marketing_report`,
`send_marketing_digest_email`.

It's a separate small project (`mcp-server/package.json`) because the MCP
SDK ships ES modules only, while the main app is CommonJS.

### Running it

```bash
cd mcp-server
npm install
```

It reads the same `.env` as the dashboard (one level up), so no separate
credentials are needed.

### Registering with Claude Code

```bash
claude mcp add rideau-marketing -- node /absolute/path/to/ga4-meta-reporting/mcp-server/index.js
```

### Registering with Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rideau-marketing": {
      "command": "node",
      "args": ["/absolute/path/to/ga4-meta-reporting/mcp-server/index.js"]
    }
  }
}
```

## What I'd build next

- Move from a live-snapshot cache to persistent trend storage, so the daily
  chart isn't rebuilt from the APIs' own historical range on every load.
- Add write-capable tools to the MCP server (e.g. pausing an underperforming
  ad) behind an explicit human-confirmation step, rather than read-only
  reporting only.
