// scripts/send-digest.js
// Standalone script: builds the report and emails it, then exits.
// Run manually with `npm run digest`, or schedule it with cron (Mac/Linux)
// or Task Scheduler (Windows) to run automatically — e.g. every Monday at
// 8am. This is more reliable than an in-process scheduler since it doesn't
// require the dashboard server to be running continuously.

require("dotenv").config();
const path = require("path");
const { buildReport } = require(path.join(__dirname, "..", "lib", "build-report"));
const { sendDigestEmail } = require(path.join(__dirname, "..", "services", "email"));

(async () => {
  console.log("Building report...");
  const { report, summary } = await buildReport({ includeSummary: true });

  console.log("Sending digest email...");
  await sendDigestEmail(report, summary);

  console.log(`Digest sent to ${process.env.DIGEST_TO_EMAIL}`);
  process.exit(0);
})().catch((err) => {
  console.error("Failed to send digest:", err.message);
  process.exit(1);
});
