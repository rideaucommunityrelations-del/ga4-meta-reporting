require("dotenv").config();
const express = require("express");
const path = require("path");
const { buildReport } = require("./lib/build-report");
const { sendDigestEmail } = require("./services/email");

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_MS = (Number(process.env.CACHE_MINUTES) || 15) * 60 * 1000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Simple in-memory cache so we don't refetch from every API on every request
let cache = { data: null, fetchedAt: 0 };

app.get("/api/report", async (req, res) => {
  const now = Date.now();
  const isFresh = cache.data && now - cache.fetchedAt < CACHE_MS;

  if (isFresh) {
    return res.json({ ...cache.data, cached: true });
  }

  try {
    const { report, summary } = await buildReport({ includeSummary: true });
    const payload = { ...report, summary };
    cache = { data: payload, fetchedAt: now };
    res.json({ ...payload, cached: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual trigger to send the email digest right now (for testing the email
// setup, or for kicking off a digest send outside a cron schedule)
app.post("/api/send-digest", async (req, res) => {
  try {
    const { report, summary } = await buildReport({ includeSummary: true });
    await sendDigestEmail(report, summary);
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ sent: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Marketing Command Center running at http://localhost:${PORT}`);
});
