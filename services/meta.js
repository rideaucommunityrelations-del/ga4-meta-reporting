// services/meta.js
// Pulls a 30-day ad performance snapshot from the Meta Marketing API,
// plus a daily spend trend, a prior-period comparison, and an ad-level
// breakdown (not just campaign-level).

const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID;
const TOKEN = process.env.META_ACCESS_TOKEN;
const API_VERSION = process.env.META_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function fmtDate(d) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function pctChange(current, previous) {
  if (!previous) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

async function fetchJSON(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`Meta API error: ${json.error.message}`);
  return json;
}

async function getMetaReport() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 30);
  const prevStart = new Date(today);
  prevStart.setDate(prevStart.getDate() - 60);
  const prevEnd = new Date(today);
  prevEnd.setDate(prevEnd.getDate() - 31);

  // 1. Account-level totals, current period (includes frequency)
  const summaryFields = "spend,impressions,clicks,ctr,cpc,frequency,actions";
  const summaryUrl =
    `${BASE_URL}/${ACCOUNT_ID}/insights` +
    `?fields=${summaryFields}&date_preset=last_30d&access_token=${TOKEN}`;
  const summaryJson = await fetchJSON(summaryUrl);
  const summary = summaryJson.data?.[0] || {};
  const conversions =
    summary.actions?.find((a) => a.action_type === "offsite_conversion")
      ?.value || summary.actions?.find((a) => a.action_type === "lead")?.value || 0;

  // 2. Same totals, prior 30 days, for comparison
  const prevUrl =
    `${BASE_URL}/${ACCOUNT_ID}/insights` +
    `?fields=spend,clicks&time_range={"since":"${fmtDate(prevStart)}","until":"${fmtDate(
      prevEnd
    )}"}&access_token=${TOKEN}`;
  const prevJson = await fetchJSON(prevUrl);
  const prevSummary = prevJson.data?.[0] || {};

  // 3. Daily spend trend
  const trendUrl =
    `${BASE_URL}/${ACCOUNT_ID}/insights` +
    `?fields=spend&time_range={"since":"${fmtDate(start)}","until":"${fmtDate(
      today
    )}"}&time_increment=1&access_token=${TOKEN}`;
  const trendJson = await fetchJSON(trendUrl);
  const dailyTrend = (trendJson.data || []).map((d) => ({
    date: d.date_start,
    spend: Number(d.spend || 0),
  }));

  // 4. Campaign-level breakdown
  const campaignFields = "campaign_name,spend,impressions,clicks,ctr,cpc";
  const campaignUrl =
    `${BASE_URL}/${ACCOUNT_ID}/insights` +
    `?level=campaign&fields=${campaignFields}&date_preset=last_30d` +
    `&limit=10&access_token=${TOKEN}`;
  const campaignJson = await fetchJSON(campaignUrl);
  const campaigns = (campaignJson.data || [])
    .map((c) => ({
      name: c.campaign_name,
      spend: Number(c.spend || 0),
      impressions: Number(c.impressions || 0),
      clicks: Number(c.clicks || 0),
      ctr: Number(Number(c.ctr || 0).toFixed(2)),
      cpc: Number(Number(c.cpc || 0).toFixed(2)),
    }))
    .sort((a, b) => b.spend - a.spend);

  // 5. Ad-level breakdown (top individual ads by spend)
  const adFields = "ad_name,spend,impressions,clicks,ctr";
  const adUrl =
    `${BASE_URL}/${ACCOUNT_ID}/insights` +
    `?level=ad&fields=${adFields}&date_preset=last_30d&limit=10&access_token=${TOKEN}`;
  const adJson = await fetchJSON(adUrl);
  const topAds = (adJson.data || [])
    .map((a) => ({
      name: a.ad_name,
      spend: Number(a.spend || 0),
      impressions: Number(a.impressions || 0),
      clicks: Number(a.clicks || 0),
      ctr: Number(Number(a.ctr || 0).toFixed(2)),
    }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);

  return {
    range: "Last 30 days",
    spend: Number(summary.spend || 0),
    impressions: Number(summary.impressions || 0),
    clicks: Number(summary.clicks || 0),
    ctr: Number(Number(summary.ctr || 0).toFixed(2)),
    cpc: Number(Number(summary.cpc || 0).toFixed(2)),
    frequency: Number(Number(summary.frequency || 0).toFixed(2)),
    conversions: Number(conversions || 0),
    comparison: {
      spend: pctChange(Number(summary.spend || 0), Number(prevSummary.spend || 0)),
      clicks: pctChange(Number(summary.clicks || 0), Number(prevSummary.clicks || 0)),
    },
    dailyTrend,
    campaigns,
    topAds,
  };
}

module.exports = { getMetaReport };
