// services/ga4.js
// Pulls a 30-day marketing snapshot from the GA4 Data API using a service
// account, plus a daily trend, a prior-period comparison, and audience
// breakdowns (device, new vs returning, geography).

const { BetaAnalyticsDataClient } = require("@google-analytics/data");

const propertyId = process.env.GA4_PROPERTY_ID;
const client = new BetaAnalyticsDataClient();

function pctChange(current, previous) {
  if (!previous) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

async function getGA4Report() {
  const property = `properties/${propertyId}`;
  const currentRange = [{ startDate: "30daysAgo", endDate: "yesterday" }];
  const previousRange = [{ startDate: "60daysAgo", endDate: "31daysAgo" }];

  // 1. Top-line totals, current period
  const [summary] = await client.runReport({
    property,
    dateRanges: currentRange,
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "conversions" },
      { name: "engagementRate" },
    ],
  });
  const totals = summary.rows?.[0]?.metricValues ?? [];
  const [sessions, activeUsers, conversions, engagementRate] = totals.map((m) =>
    Number(m.value)
  );

  // 2. Same totals, prior period, for comparison badges
  const [prevSummary] = await client.runReport({
    property,
    dateRanges: previousRange,
    metrics: [
      { name: "sessions" },
      { name: "activeUsers" },
      { name: "conversions" },
    ],
  });
  const prevTotals = prevSummary.rows?.[0]?.metricValues ?? [];
  const [prevSessions, prevActiveUsers, prevConversions] = prevTotals.map((m) =>
    Number(m.value)
  );

  // 3. Daily trend (for the chart)
  const [trendReport] = await client.runReport({
    property,
    dateRanges: currentRange,
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });
  const dailyTrend = (trendReport.rows ?? []).map((row) => ({
    date: row.dimensionValues[0].value, // YYYYMMDD
    sessions: Number(row.metricValues[0].value),
  }));

  // 4. Traffic by channel
  const [channelReport] = await client.runReport({
    property,
    dateRanges: currentRange,
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 8,
  });
  const topChannels = (channelReport.rows ?? []).map((row) => ({
    channel: row.dimensionValues[0].value,
    sessions: Number(row.metricValues[0].value),
    conversions: Number(row.metricValues[1].value),
  }));

  // 5. Top landing pages
  const [pageReport] = await client.runReport({
    property,
    dateRanges: currentRange,
    dimensions: [{ name: "landingPagePlusQueryString" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 5,
  });
  const topPages = (pageReport.rows ?? []).map((row) => ({
    page: row.dimensionValues[0].value,
    sessions: Number(row.metricValues[0].value),
  }));

  // 6. Device breakdown
  const [deviceReport] = await client.runReport({
    property,
    dateRanges: currentRange,
    dimensions: [{ name: "deviceCategory" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
  });
  const deviceBreakdown = (deviceReport.rows ?? []).map((row) => ({
    device: row.dimensionValues[0].value,
    sessions: Number(row.metricValues[0].value),
  }));

  // 7. New vs returning
  const [nvrReport] = await client.runReport({
    property,
    dateRanges: currentRange,
    dimensions: [{ name: "newVsReturning" }],
    metrics: [{ name: "sessions" }],
  });
  const newVsReturning = (nvrReport.rows ?? []).map((row) => ({
    type: row.dimensionValues[0].value === "new" ? "New" : "Returning",
    sessions: Number(row.metricValues[0].value),
  }));

  // 8. Top geography
  const [geoReport] = await client.runReport({
    property,
    dateRanges: currentRange,
    dimensions: [{ name: "country" }],
    metrics: [{ name: "sessions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 5,
  });
  const topCountries = (geoReport.rows ?? []).map((row) => ({
    country: row.dimensionValues[0].value,
    sessions: Number(row.metricValues[0].value),
  }));

  return {
    range: "Last 30 days",
    sessions: sessions || 0,
    activeUsers: activeUsers || 0,
    conversions: conversions || 0,
    engagementRate: engagementRate ? Number((engagementRate * 100).toFixed(1)) : 0,
    comparison: {
      sessions: pctChange(sessions, prevSessions),
      activeUsers: pctChange(activeUsers, prevActiveUsers),
      conversions: pctChange(conversions, prevConversions),
    },
    dailyTrend,
    topChannels,
    topPages,
    deviceBreakdown,
    newVsReturning,
    topCountries,
  };
}

module.exports = { getGA4Report };
