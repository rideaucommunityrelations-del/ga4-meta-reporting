// mcp-server/index.js
//
// Exposes the same GA4 / Meta / Search Console reporting logic from the
// dashboard as MCP tools, so Claude (in Claude Code, Claude Desktop, or any
// other MCP-aware client) can query real marketing data directly through
// natural language instead of through the dashboard UI.
//
// This deliberately reuses the existing services/ modules rather than
// duplicating the API logic — the dashboard and this MCP server are two
// different front ends on the same data layer.

import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the same .env the dashboard uses, one level up
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Import the existing CommonJS service modules from ESM.
// Node exposes a CJS module's `module.exports` as the ESM default export,
// so each of these gives us back the same functions the dashboard uses.
const { getGA4Report } = (await import("../services/ga4.js")).default;
const { getMetaReport } = (await import("../services/meta.js")).default;
const { getSearchConsoleReport } = (await import("../services/search-console.js")).default;
const { buildReport } = (await import("../lib/build-report.js")).default;
const { sendDigestEmail } = (await import("../services/email.js")).default;

function textResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err) {
  return {
    content: [{ type: "text", text: `Error: ${err.message}` }],
    isError: true,
  };
}

const handle = serveStdio(() => {
  const server = new McpServer({ name: "rideau-marketing-reporting", version: "1.0.0" });

  server.registerTool(
    "get_ga4_report",
    {
      title: "Get GA4 website report",
      description:
        "Fetches the last 30 days of Google Analytics 4 data for Rideau Retirement Residence: sessions, active users, conversions, engagement rate, a daily trend, a comparison to the prior 30 days, top channels, top landing pages, device breakdown, new vs returning users, and top countries.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await getGA4Report();
        return textResult(data);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "get_meta_report",
    {
      title: "Get Meta Ads report",
      description:
        "Fetches the last 30 days of Meta Ads performance for Rideau Retirement Residence: spend, impressions, clicks, CTR, CPC, frequency, conversions, a daily spend trend, a comparison to the prior 30 days, a campaign-level breakdown, and the top individual ads by spend.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await getMetaReport();
        return textResult(data);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "get_search_console_report",
    {
      title: "Get Search Console report",
      description:
        "Fetches the last 30 days of Google Search Console data for Rideau Retirement Residence: total organic clicks, impressions, average position, and the top 10 search queries with their clicks, impressions, CTR, and position. Returns an error if GSC_SITE_URL is not configured.",
      inputSchema: {},
    },
    async () => {
      try {
        const data = await getSearchConsoleReport();
        return textResult(data);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "get_full_marketing_report",
    {
      title: "Get the full combined marketing report",
      description:
        "Fetches and merges GA4, Meta Ads, and (if configured) Search Console data for the last 30 days in one call — the same data shown on the Marketing Command Center dashboard. Use this when a question needs the full picture rather than a single platform.",
      inputSchema: {},
    },
    async () => {
      try {
        const { report } = await buildReport({ includeSummary: false });
        return textResult(report);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "send_marketing_digest_email",
    {
      title: "Send the marketing report as an email digest",
      description:
        "Builds the current 30-day combined report and emails it to the configured DIGEST_TO_EMAIL address as a formatted summary. Use this when asked to send, email, or deliver the marketing report.",
      inputSchema: {},
    },
    async () => {
      try {
        const { report, summary } = await buildReport({ includeSummary: true });
        await sendDigestEmail(report, summary);
        return textResult({ sent: true, to: process.env.DIGEST_TO_EMAIL });
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  return server;
});

console.error("Rideau marketing MCP server is listening on stdio");
