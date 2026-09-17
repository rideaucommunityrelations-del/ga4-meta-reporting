// services/search-console.js
// Pulls 30-day organic search data from the Search Console API, using the
// SAME service account JSON key as GA4 (no separate credentials needed) —
// it just needs the Search Console API enabled in Cloud Console, and the
// service account added as a user on the Search Console property.

const { google } = require("googleapis");

const SITE_URL = process.env.GSC_SITE_URL;

function fmtDate(d) {
  return d.toISOString().slice(0, 10);
}

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  return auth.getClient();
}

async function getSearchConsoleReport() {
  const authClient = await getAuthClient();
  const searchconsole = google.searchconsole({ version: "v1", auth: authClient });

  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  // GSC data typically lags 2-3 days, so end a few days before today
  const end = new Date(today);
  end.setDate(end.getDate() - 3);

  // Totals
  const totalsRes = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: fmtDate(start),
      endDate: fmtDate(end),
    },
  });
  const totals = totalsRes.data.rows?.[0] || {};

  // Top queries
  const queryRes = await searchconsole.searchanalytics.query({
    siteUrl: SITE_URL,
    requestBody: {
      startDate: fmtDate(start),
      endDate: fmtDate(end),
      dimensions: ["query"],
      rowLimit: 10,
    },
  });
  const topQueries = (queryRes.data.rows || []).map((row) => ({
    query: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: Number((row.ctr * 100).toFixed(2)),
    position: Number(row.position.toFixed(1)),
  }));

  return {
    range: "Last 30 days (GSC, ~3 day lag)",
    clicks: totals.clicks || 0,
    impressions: totals.impressions || 0,
    ctr: totals.ctr ? Number((totals.ctr * 100).toFixed(2)) : 0,
    avgPosition: totals.position ? Number(totals.position.toFixed(1)) : 0,
    topQueries,
  };
}

module.exports = { getSearchConsoleReport };
