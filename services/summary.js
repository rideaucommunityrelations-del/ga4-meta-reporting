// services/summary.js
// Generates a short plain-English summary of the combined report using the
// Anthropic API. If no ANTHROPIC_API_KEY is set, this quietly returns null
// so the rest of the dashboard works fine without it.

const Anthropic = require("@anthropic-ai/sdk");

async function getAISummary(report) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const condensed = {
    ga4: {
      sessions: report.ga4?.sessions,
      activeUsers: report.ga4?.activeUsers,
      conversions: report.ga4?.conversions,
      comparison: report.ga4?.comparison,
      topChannels: report.ga4?.topChannels?.slice(0, 3),
    },
    meta: {
      spend: report.meta?.spend,
      clicks: report.meta?.clicks,
      ctr: report.meta?.ctr,
      comparison: report.meta?.comparison,
      topCampaigns: report.meta?.campaigns?.slice(0, 3),
    },
    searchConsole: report.gsc
      ? {
          clicks: report.gsc.clicks,
          avgPosition: report.gsc.avgPosition,
          topQueries: report.gsc.topQueries?.slice(0, 3),
        }
      : null,
  };

  try {
    const msg = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 250,
      messages: [
        {
          role: "user",
          content:
            "You are a marketing analyst summarizing a weekly performance report for a non-technical stakeholder. " +
            "In 3-4 short sentences, plain English, no jargon, highlight the single most important trend or " +
            "opportunity in this data. Be specific with numbers where useful.\n\n" +
            JSON.stringify(condensed),
        },
      ],
    });
    const textBlock = msg.content.find((c) => c.type === "text");
    return textBlock ? textBlock.text : null;
  } catch (err) {
    console.error("AI summary failed:", err.message);
    return null;
  }
}

module.exports = { getAISummary };
