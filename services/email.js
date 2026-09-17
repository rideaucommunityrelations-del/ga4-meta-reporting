// services/email.js
// Sends the combined report as a formatted HTML email via SMTP.

const nodemailer = require("nodemailer");

function buildDigestHTML(report, summary) {
  const ga4 = report.ga4 || {};
  const meta = report.meta || {};
  const gsc = report.gsc || {};

  const row = (label, value) =>
    `<tr><td style="padding:6px 12px; color:#555;">${label}</td><td style="padding:6px 12px; font-weight:600;">${value}</td></tr>`;

  return `
  <div style="font-family: -apple-system, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
    <h2 style="margin-bottom: 4px;">Marketing Command Center — Weekly Digest</h2>
    <p style="color:#777; margin-top:0;">${new Date().toLocaleDateString()} · Last 30 days</p>

    ${summary ? `<div style="background:#f4f6f8; border-radius:8px; padding:14px 16px; margin-bottom:20px; line-height:1.5;">${summary}</div>` : ""}

    <h3>Website (GA4)</h3>
    <table style="border-collapse:collapse; width:100%;">
      ${row("Sessions", ga4.sessions ?? "—")}
      ${row("Active Users", ga4.activeUsers ?? "—")}
      ${row("Conversions", ga4.conversions ?? "—")}
      ${row("Engagement Rate", ga4.engagementRate ? ga4.engagementRate + "%" : "—")}
    </table>

    <h3>Meta Ads</h3>
    <table style="border-collapse:collapse; width:100%;">
      ${row("Spend", meta.spend ? "$" + meta.spend.toFixed(2) : "—")}
      ${row("Clicks", meta.clicks ?? "—")}
      ${row("CTR", meta.ctr ? meta.ctr + "%" : "—")}
      ${row("CPC", meta.cpc ? "$" + meta.cpc.toFixed(2) : "—")}
    </table>

    ${
      gsc.clicks !== undefined
        ? `<h3>Search Console</h3>
    <table style="border-collapse:collapse; width:100%;">
      ${row("Organic Clicks", gsc.clicks)}
      ${row("Impressions", gsc.impressions)}
      ${row("Avg Position", gsc.avgPosition)}
    </table>`
        : ""
    }

    <p style="color:#999; font-size:12px; margin-top:24px;">Sent automatically by the Marketing Command Center reporting tool.</p>
  </div>`;
}

async function sendDigestEmail(report, summary) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.DIGEST_TO_EMAIL,
    subject: `Marketing Report — ${new Date().toLocaleDateString()}`,
    html: buildDigestHTML(report, summary),
  });
}

module.exports = { sendDigestEmail, buildDigestHTML };
