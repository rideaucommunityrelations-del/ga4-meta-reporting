// lib/build-report.js
// Fetches GA4 + Meta (+ Search Console if configured) in parallel and
// merges them into one report object. Shared by server.js and
// scripts/send-digest.js so there's one source of truth for report shape.

const { getGA4Report } = require("../services/ga4");
const { getMetaReport } = require("../services/meta");
const { getSearchConsoleReport } = require("../services/search-console");
const { getAISummary } = require("../services/summary");

async function buildReport({ includeSummary = false } = {}) {
  const tasks = [getGA4Report(), getMetaReport()];
  const hasGSC = Boolean(process.env.GSC_SITE_URL);
  if (hasGSC) tasks.push(getSearchConsoleReport());

  const results = await Promise.allSettled(tasks);
  const [ga4Result, metaResult, gscResult] = results;

  const report = {
    generatedAt: new Date().toISOString(),
    ga4: ga4Result.status === "fulfilled" ? ga4Result.value : { error: ga4Result.reason?.message },
    meta: metaResult.status === "fulfilled" ? metaResult.value : { error: metaResult.reason?.message },
  };

  if (hasGSC) {
    report.gsc =
      gscResult.status === "fulfilled" ? gscResult.value : { error: gscResult.reason?.message };
  }

  let summary = null;
  if (includeSummary) {
    summary = await getAISummary(report);
  }

  return { report, summary };
}

module.exports = { buildReport };
